import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';
import { ProcessingError } from '../../utils/errors';
import { TemplateLoader } from '../../remotion/templateLoader';

const logger = createLogger('EditingPlanService');

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Highlight {
  startTime: number;
  endTime: number;
  confidence: number;
  reason: string;
}

export interface EditingPlanInput {
  transcript: TranscriptSegment[];
  highlights: Highlight[];
  videoDuration: number;
}

export interface HighlightEffect {
  startTime: number;
  endTime: number;
  effectType: 'zoom' | 'highlight-box' | 'text-overlay';
  parameters: Record<string, any>;
}

export interface AnimationEffect {
  startTime: number;
  duration: number;
  template: string;
  text?: string;
  parameters: Record<string, any>;
}

export interface TransitionEffect {
  time: number;
  type: 'fade' | 'slide' | 'wipe';
  duration: number;
}

export interface BrollPlacement {
  startTime: number;
  duration: number;
  searchTerm: string;
}

export interface ZoomEffect {
  id: string;
  startTime: number;
  endTime: number;
  targetScale: number;
  easingFunction: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear';
  zoomDuration: number; // milliseconds
}

export interface EditingPlan {
  highlights: HighlightEffect[];
  animations: AnimationEffect[];
  transitions: TransitionEffect[];
  brollPlacements: BrollPlacement[];
  zoomEffects?: ZoomEffect[];
}

/**
 * LLM Editing Plan Service
 * 
 * Uses Google Gemini to generate intelligent editing plans
 * based on transcript and detected highlights
 */
export class EditingPlanService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.gemini.model });
  }

  /**
   * Generate editing plan using Gemini LLM
   */
  async generatePlan(input: EditingPlanInput): Promise<EditingPlan> {
    const jobId = `plan-${Date.now()}`;

    logger.info('Starting editing plan generation', {
      jobId,
      transcriptSegments: input.transcript.length,
      highlights: input.highlights.length,
      videoDuration: input.videoDuration,
    });

    // Retry logic with exponential backoff
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info('Editing plan generation attempt', {
          jobId,
          attempt,
          maxAttempts,
        });

        const plan = await this.generatePlanInternal(input, jobId);

        // Validate the plan
        this.validatePlan(plan, input.videoDuration);

        logger.info('Editing plan generated successfully', {
          jobId,
          attempt,
          highlightEffects: plan.highlights.length,
          animations: plan.animations.length,
          transitions: plan.transitions.length,
          brollPlacements: plan.brollPlacements.length,
        });

        return plan;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn('Editing plan generation attempt failed', {
          jobId,
          attempt,
          maxAttempts,
          error: lastError.message,
        });

        // Don't wait after the last attempt
        if (attempt < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          logger.info('Waiting before retry', {
            jobId,
            delayMs,
          });
          await this.delay(delayMs);
        }
      }
    }

    // All attempts failed
    const errorMessage = `Editing plan generation failed after ${maxAttempts} attempts: ${lastError?.message}`;
    logger.error('Editing plan generation failed', {
      jobId,
      attempts: maxAttempts,
      error: lastError?.message,
    });

    throw new ProcessingError(errorMessage, {
      jobId,
      stage: 'generating-plan',
      attemptNumber: maxAttempts,
    });
  }

  /**
   * Internal method to generate plan (single attempt)
   */
  private async generatePlanInternal(
    input: EditingPlanInput,
    jobId: string
  ): Promise<EditingPlan> {
    // Build prompt with available templates
    const prompt = this.buildPrompt(input);

    logger.debug('Sending prompt to Gemini', {
      jobId,
      promptLength: prompt.length,
    });

    // Call Gemini API
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    logger.debug('Received response from Gemini', {
      jobId,
      responseLength: text.length,
    });

    // Parse JSON response
    const plan = this.parseResponse(text);

    return plan;
  }

  /**
   * Build prompt for Gemini with transcript, highlights, and available templates
   */
  private buildPrompt(input: EditingPlanInput): string {
    const templateList = TemplateLoader.generateTemplateListForLLM();

    const transcriptText = input.transcript
      .map((seg) => `[${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s] ${seg.text}`)
      .join('\n');

    const highlightsText = input.highlights
      .map(
        (h) =>
          `[${h.startTime.toFixed(2)}s - ${h.endTime.toFixed(2)}s] ${h.reason} (confidence: ${h.confidence})`
      )
      .join('\n');

    return `You are a professional video editor. Generate an editing plan for a video based on the transcript and detected highlights.

Video Duration: ${input.videoDuration.toFixed(2)} seconds

Transcript:
${transcriptText}

Detected Highlights:
${highlightsText || 'No highlights detected'}

${templateList}

Generate a JSON editing plan with the following structure:
{
  "highlights": [
    {
      "startTime": <number>,
      "endTime": <number>,
      "effectType": "zoom" | "highlight-box" | "text-overlay",
      "parameters": { ... }
    }
  ],
  "animations": [
    {
      "startTime": <number>,
      "duration": <number>,
      "template": "<template-name>",
      "text": "<optional-text>",
      "parameters": { ... }
    }
  ],
  "transitions": [
    {
      "time": <number>,
      "type": "fade" | "slide" | "wipe",
      "duration": <number>
    }
  ],
  "brollPlacements": [
    {
      "startTime": <number>,
      "duration": <number>,
      "searchTerm": "<search-term>"
    }
  ]
}

Guidelines:
1. Use highlight effects to emphasize important moments
2. Add animations at key points using the available templates
3. Add transitions between major sections
4. Suggest B-roll placements to enhance visual interest
5. Ensure all timestamps are within the video duration (0 to ${input.videoDuration.toFixed(2)}s)
6. Only use animation templates from the list above
7. Keep animations short (2-5 seconds typically)
8. Don't overdo it - quality over quantity

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Parse Gemini response to extract editing plan
   */
  private parseResponse(text: string): EditingPlan {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(jsonText);

      // Ensure all required fields exist
      const plan: EditingPlan = {
        highlights: parsed.highlights || [],
        animations: parsed.animations || [],
        transitions: parsed.transitions || [],
        brollPlacements: parsed.brollPlacements || [],
      };

      return plan;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to parse Gemini response', {
        error: errorMessage,
        responseText: text.substring(0, 500),
      });
      throw new Error(`Failed to parse editing plan JSON: ${errorMessage}`);
    }
  }

  /**
   * Validate editing plan structure and content
   */
  private validatePlan(plan: EditingPlan, videoDuration: number): void {
    // Validate highlights
    for (const highlight of plan.highlights) {
      if (highlight.startTime < 0 || highlight.endTime > videoDuration) {
        throw new Error(
          `Invalid highlight timestamp: ${highlight.startTime}s - ${highlight.endTime}s (video duration: ${videoDuration}s)`
        );
      }
      if (highlight.startTime >= highlight.endTime) {
        throw new Error(
          `Invalid highlight: start time (${highlight.startTime}s) >= end time (${highlight.endTime}s)`
        );
      }
      if (!['zoom', 'highlight-box', 'text-overlay'].includes(highlight.effectType)) {
        throw new Error(`Invalid highlight effect type: ${highlight.effectType}`);
      }
    }

    // Validate animations
    for (const animation of plan.animations) {
      if (animation.startTime < 0 || animation.startTime + animation.duration > videoDuration) {
        throw new Error(
          `Invalid animation timestamp: ${animation.startTime}s + ${animation.duration}s (video duration: ${videoDuration}s)`
        );
      }
      if (animation.duration <= 0) {
        throw new Error(`Invalid animation duration: ${animation.duration}s`);
      }

      // Validate template exists
      if (!TemplateLoader.templateExists(animation.template)) {
        throw new Error(
          `Animation template does not exist: ${animation.template}. Available templates: ${TemplateLoader.getAvailableTemplates().join(', ')}`
        );
      }
    }

    // Validate transitions
    for (const transition of plan.transitions) {
      if (transition.time < 0 || transition.time > videoDuration) {
        throw new Error(
          `Invalid transition timestamp: ${transition.time}s (video duration: ${videoDuration}s)`
        );
      }
      if (transition.duration <= 0) {
        throw new Error(`Invalid transition duration: ${transition.duration}s`);
      }
      if (!['fade', 'slide', 'wipe'].includes(transition.type)) {
        throw new Error(`Invalid transition type: ${transition.type}`);
      }
    }

    // Validate B-roll placements
    for (const broll of plan.brollPlacements) {
      if (broll.startTime < 0 || broll.startTime + broll.duration > videoDuration) {
        throw new Error(
          `Invalid B-roll timestamp: ${broll.startTime}s + ${broll.duration}s (video duration: ${videoDuration}s)`
        );
      }
      if (broll.duration <= 0) {
        throw new Error(`Invalid B-roll duration: ${broll.duration}s`);
      }
      if (!broll.searchTerm || broll.searchTerm.trim() === '') {
        throw new Error('B-roll placement must have a search term');
      }
    }

    // Validate zoom effects
    if (plan.zoomEffects) {
      for (const zoom of plan.zoomEffects) {
        if (zoom.startTime < 0 || zoom.endTime > videoDuration) {
          throw new Error(
            `Invalid zoom effect timestamp: ${zoom.startTime}s - ${zoom.endTime}s (video duration: ${videoDuration}s)`
          );
        }
        if (zoom.startTime >= zoom.endTime) {
          throw new Error(
            `Invalid zoom effect: start time (${zoom.startTime}s) >= end time (${zoom.endTime}s)`
          );
        }
        if (zoom.targetScale <= 0) {
          throw new Error(`Invalid zoom target scale: ${zoom.targetScale}`);
        }
        if (zoom.zoomDuration <= 0) {
          throw new Error(`Invalid zoom duration: ${zoom.zoomDuration}ms`);
        }
        if (!['ease-in-out', 'ease-in', 'ease-out', 'linear'].includes(zoom.easingFunction)) {
          throw new Error(`Invalid zoom easing function: ${zoom.easingFunction}`);
        }
      }

      // Check for overlapping zoom effects
      const overlaps = this.detectZoomOverlaps(plan.zoomEffects);
      if (overlaps.length > 0) {
        logger.warn('Overlapping zoom effects detected', {
          overlaps: overlaps.length,
          conflicts: overlaps,
        });
        // Resolve overlaps by adjusting timing
        this.resolveZoomOverlaps(plan.zoomEffects);
      }
    }

    logger.info('Editing plan validation passed', {
      highlights: plan.highlights.length,
      animations: plan.animations.length,
      transitions: plan.transitions.length,
      brollPlacements: plan.brollPlacements.length,
      zoomEffects: plan.zoomEffects?.length || 0,
    });
  }

  /**
   * Detect overlapping zoom effects
   */
  private detectZoomOverlaps(zoomEffects: ZoomEffect[]): Array<{ effect1: string; effect2: string; overlapDuration: number }> {
    const overlaps: Array<{ effect1: string; effect2: string; overlapDuration: number }> = [];

    for (let i = 0; i < zoomEffects.length; i++) {
      for (let j = i + 1; j < zoomEffects.length; j++) {
        const zoom1 = zoomEffects[i];
        const zoom2 = zoomEffects[j];

        // Check if time ranges overlap
        const overlap = this.calculateOverlap(
          zoom1.startTime,
          zoom1.endTime,
          zoom2.startTime,
          zoom2.endTime
        );

        if (overlap > 0) {
          overlaps.push({
            effect1: zoom1.id,
            effect2: zoom2.id,
            overlapDuration: overlap,
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Calculate overlap between two time ranges
   */
  private calculateOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): number {
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);
    return Math.max(0, overlapEnd - overlapStart);
  }

  /**
   * Resolve overlapping zoom effects by adjusting timing
   */
  private resolveZoomOverlaps(zoomEffects: ZoomEffect[]): void {
    // Sort by start time
    zoomEffects.sort((a, b) => a.startTime - b.startTime);

    for (let i = 0; i < zoomEffects.length - 1; i++) {
      const current = zoomEffects[i];
      const next = zoomEffects[i + 1];

      // If current overlaps with next, adjust next's start time
      if (current.endTime > next.startTime) {
        const gap = 0.1; // 100ms gap between zoom effects
        const newStartTime = current.endTime + gap;
        const duration = next.endTime - next.startTime;
        
        next.startTime = newStartTime;
        next.endTime = newStartTime + duration;

        logger.info('Resolved zoom effect overlap', {
          currentId: current.id,
          nextId: next.id,
          newStartTime,
          newEndTime: next.endTime,
        });
      }
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Save editing plan to JSON file
   * Useful for debugging and inspection
   */
  async savePlanToFile(plan: EditingPlan, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    
    // Write plan to file
    await fs.writeFile(outputPath, JSON.stringify(plan, null, 2), 'utf-8');
    
    logger.info('Editing plan saved to file', {
      outputPath,
      highlights: plan.highlights.length,
      animations: plan.animations.length,
      transitions: plan.transitions.length,
      brollPlacements: plan.brollPlacements.length,
    });
  }
}
