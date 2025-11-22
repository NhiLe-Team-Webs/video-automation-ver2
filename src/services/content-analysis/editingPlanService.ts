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
  videoMetadata?: VideoMetadata;
  brandKit?: BrandKit;
}

export interface VideoMetadata {
  duration: number;
  resolution: { width: number; height: number };
  format: string;
  aspectRatio?: string;
}

export interface BrandKit {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    textColor: string;
    backgroundColor: string;
  };
  typography: {
    fontFamily: string;
    fontSize: { small: number; medium: number; large: number };
    fontWeight: number;
  };
  animationPreferences: {
    styleFamily: string;
    preferredTemplates: string[];
    timing: {
      textAppearDuration: number;
      textDisappearDuration: number;
      transitionDuration: number;
      zoomDuration: number;
    };
  };
  transitionPreferences: {
    type: 'fade' | 'slide' | 'wipe';
    duration: number;
    easing: string;
  };
  effectPreferences: {
    intensity: {
      colorGrading: number;
      contrast: number;
      saturation: number;
      sharpness: number;
      vignette: number;
    };
  };
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
  soundEffect?: string;
}

export interface BrollPlacement {
  startTime: number;
  duration: number;
  searchTerm: string;
  fadeInDuration: number;
  fadeOutDuration: number;
}

export interface ZoomEffect {
  id: string;
  startTime: number;
  endTime: number;
  targetScale: number;
  easingFunction: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear';
  zoomDuration: number; // milliseconds
  soundEffect?: string;
}

export interface SoundEffectPlacement {
  timestamp: number;
  effectType: 'text-appear' | 'zoom' | 'transition' | 'whoosh' | 'pop';
  soundEffectId: string;
  volume: number;
}

export interface TextHighlight {
  text: string;
  startTime: number;
  duration: number;
  style: TextStyle;
  soundEffect?: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  animation: 'fade-in' | 'slide-up' | 'pop' | 'typewriter';
}

export interface ColorGradingSettings {
  temperature: number;
  tint: number;
  contrast: number;
  saturation: number;
  highlights: number;
  shadows: number;
}

export interface CutFilterSettings {
  colorGrading: ColorGradingSettings;
  applySharpening: boolean;
  sharpeningIntensity: number;
  applyVignette: boolean;
  vignetteIntensity: number;
}

export interface EditingPlan {
  highlights: HighlightEffect[];
  animations: AnimationEffect[];
  transitions: TransitionEffect[];
  brollPlacements: BrollPlacement[];
  zoomEffects: ZoomEffect[];
  soundEffects: SoundEffectPlacement[];
  textHighlights: TextHighlight[];
  cutFilters: CutFilterSettings;
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

    // Brand kit information
    const brandKitInfo = input.brandKit ? `
Brand Kit Configuration:
- Style Family: ${input.brandKit.animationPreferences.styleFamily}
- Preferred Templates: ${input.brandKit.animationPreferences.preferredTemplates.join(', ')}
- Primary Color: ${input.brandKit.colors.primary}
- Text Color: ${input.brandKit.colors.textColor}
- Font Family: ${input.brandKit.typography.fontFamily}
- Transition Type: ${input.brandKit.transitionPreferences.type}
- Transition Duration: ${input.brandKit.transitionPreferences.duration}ms
` : '';

    // Video metadata information
    const videoInfo = input.videoMetadata ? `
Video Metadata:
- Resolution: ${input.videoMetadata.resolution.width}x${input.videoMetadata.resolution.height}
- Format: ${input.videoMetadata.format}
- Aspect Ratio: ${input.videoMetadata.aspectRatio || 'unknown'}
` : '';

    // Calculate max B-roll count based on duration
    const maxBrollCount = Math.floor(input.videoDuration / 30);

    return `You are a professional video editor. Generate a comprehensive editing plan for a video based on the transcript and detected highlights.

Video Duration: ${input.videoDuration.toFixed(2)} seconds
${videoInfo}${brandKitInfo}

Transcript:
${transcriptText}

Detected Highlights:
${highlightsText || 'No highlights detected'}

${templateList}

Available Sound Effect Categories:
- text-appear: For text highlight appearances
- zoom: For zoom effects
- transition: For scene transitions
- whoosh: For fast movements
- pop: For emphasis

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
      "duration": <number>,
      "soundEffect": "transition"
    }
  ],
  "brollPlacements": [
    {
      "startTime": <number>,
      "duration": <number>,
      "searchTerm": "<search-term>",
      "fadeInDuration": <number>,
      "fadeOutDuration": <number>
    }
  ],
  "zoomEffects": [
    {
      "id": "zoom-<number>",
      "startTime": <number>,
      "endTime": <number>,
      "targetScale": 1.2,
      "easingFunction": "ease-in-out",
      "zoomDuration": 400,
      "soundEffect": "zoom"
    }
  ],
  "soundEffects": [
    {
      "timestamp": <number>,
      "effectType": "text-appear" | "zoom" | "transition" | "whoosh" | "pop",
      "soundEffectId": "<category>",
      "volume": 0.25
    }
  ],
  "textHighlights": [
    {
      "text": "<phrase>",
      "startTime": <number>,
      "duration": <number>,
      "style": {
        "fontFamily": "<font>",
        "fontSize": <number>,
        "fontWeight": <number>,
        "color": "<hex-color>",
        "animation": "fade-in" | "slide-up" | "pop" | "typewriter"
      },
      "soundEffect": "text-appear"
    }
  ],
  "cutFilters": {
    "colorGrading": {
      "temperature": <number>,
      "tint": <number>,
      "contrast": <number>,
      "saturation": <number>,
      "highlights": <number>,
      "shadows": <number>
    },
    "applySharpening": <boolean>,
    "sharpeningIntensity": <number>,
    "applyVignette": true,
    "vignetteIntensity": <number>
  }
}

CRITICAL RULES - YOU MUST FOLLOW THESE:

1. STYLE CONSISTENCY:
   - Use ONLY ONE transition type throughout the entire video (${input.brandKit?.transitionPreferences.type || 'fade'})
   - Use ONLY templates from the same style family (${input.brandKit?.animationPreferences.styleFamily || 'professional'})
   - Preferred templates: ${input.brandKit?.animationPreferences.preferredTemplates.join(', ') || 'animated-text, slide-text, pulsing-text'}
   - All text highlights must use the same font family: ${input.brandKit?.typography.fontFamily || 'Inter, sans-serif'}

2. B-ROLL LIMITS:
   - Maximum ${maxBrollCount} B-roll placements (1 per 30 seconds)
   - Place B-roll ONLY at highlight moments
   - Maximum duration per B-roll: 5 seconds
   - Include fadeInDuration and fadeOutDuration (200-400ms each)

3. ZOOM EFFECTS:
   - Generate a zoom effect for EVERY highlight
   - targetScale must be exactly 1.2 (120%)
   - zoomDuration must be exactly 400ms
   - easingFunction must be "ease-in-out"
   - Include soundEffect: "zoom" for each zoom

4. SOUND EFFECTS:
   - Add sound effect for EVERY text highlight (effectType: "text-appear")
   - Add sound effect for EVERY zoom effect (effectType: "zoom")
   - Add sound effect for EVERY transition (effectType: "transition")
   - Volume should be 0.25 (25% of main audio)

5. TEXT HIGHLIGHT TIMING:
   - Text startTime must be 300ms BEFORE the corresponding audio timestamp
   - Minimum text duration: 1 second
   - Minimum gap between consecutive text highlights: 500ms
   - Include soundEffect: "text-appear" for each text highlight

6. TRANSITION TIMING:
   - All transitions must be between 300ms and 500ms
   - Use duration: ${input.brandKit?.transitionPreferences.duration || 400}ms

7. CUT FILTERS (based on video quality):
   - Apply sharpening if resolution < 1920x1080: ${input.videoMetadata && input.videoMetadata.resolution.width < 1920 ? 'true' : 'false'}
   - Saturation must be between 0.5 and 1.5 (recommend: ${input.brandKit?.effectPreferences.intensity.saturation || 1.1})
   - Contrast must be between 0.8 and 1.3 (recommend: ${input.brandKit?.effectPreferences.intensity.contrast || 1.1})
   - Always apply vignette with intensity 0.1-0.15 (recommend: ${input.brandKit?.effectPreferences.intensity.vignette || 0.12})

8. VALIDATION:
   - All timestamps must be within 0 to ${input.videoDuration.toFixed(2)}s
   - No overlapping zoom effects
   - Consistent style throughout

Return ONLY the JSON object, no additional text or markdown formatting.`;
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

      // Ensure all required fields exist with defaults
      const plan: EditingPlan = {
        highlights: parsed.highlights || [],
        animations: parsed.animations || [],
        transitions: parsed.transitions || [],
        brollPlacements: parsed.brollPlacements || [],
        zoomEffects: parsed.zoomEffects || [],
        soundEffects: parsed.soundEffects || [],
        textHighlights: parsed.textHighlights || [],
        cutFilters: parsed.cutFilters || {
          colorGrading: {
            temperature: 0,
            tint: 0,
            contrast: 1.1,
            saturation: 1.1,
            highlights: 0,
            shadows: 0,
          },
          applySharpening: false,
          sharpeningIntensity: 0.2,
          applyVignette: true,
          vignetteIntensity: 0.12,
        },
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
      if (broll.duration > 5) {
        throw new Error(`B-roll duration exceeds maximum of 5 seconds: ${broll.duration}s`);
      }
      if (!broll.searchTerm || broll.searchTerm.trim() === '') {
        throw new Error('B-roll placement must have a search term');
      }
      if (!broll.fadeInDuration || broll.fadeInDuration <= 0) {
        throw new Error(`B-roll must have valid fadeInDuration: ${broll.fadeInDuration}ms`);
      }
      if (!broll.fadeOutDuration || broll.fadeOutDuration <= 0) {
        throw new Error(`B-roll must have valid fadeOutDuration: ${broll.fadeOutDuration}ms`);
      }
    }

    // Validate B-roll frequency limit (max 1 per 30 seconds)
    const maxBrollCount = Math.floor(videoDuration / 30);
    if (plan.brollPlacements.length > maxBrollCount) {
      logger.warn('B-roll frequency exceeds limit', {
        count: plan.brollPlacements.length,
        maxAllowed: maxBrollCount,
        videoDuration,
      });
      // Trim to max allowed
      plan.brollPlacements = plan.brollPlacements.slice(0, maxBrollCount);
    }

    // Validate zoom effects
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
      // Enforce zoom scale of 1.2 (120%)
      if (Math.abs(zoom.targetScale - 1.2) > 0.01) {
        logger.warn('Zoom scale adjusted to 1.2', {
          original: zoom.targetScale,
          adjusted: 1.2,
        });
        zoom.targetScale = 1.2;
      }
      if (zoom.zoomDuration <= 0) {
        throw new Error(`Invalid zoom duration: ${zoom.zoomDuration}ms`);
      }
      // Enforce zoom duration of 400ms
      if (zoom.zoomDuration !== 400) {
        logger.warn('Zoom duration adjusted to 400ms', {
          original: zoom.zoomDuration,
          adjusted: 400,
        });
        zoom.zoomDuration = 400;
      }
      if (!['ease-in-out', 'ease-in', 'ease-out', 'linear'].includes(zoom.easingFunction)) {
        throw new Error(`Invalid zoom easing function: ${zoom.easingFunction}`);
      }
      // Prefer ease-in-out for smooth motion
      if (zoom.easingFunction === 'linear') {
        logger.warn('Zoom easing adjusted to ease-in-out', {
          original: zoom.easingFunction,
          adjusted: 'ease-in-out',
        });
        zoom.easingFunction = 'ease-in-out';
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

    // Validate sound effects
    for (const sfx of plan.soundEffects) {
      if (sfx.timestamp < 0 || sfx.timestamp > videoDuration) {
        throw new Error(
          `Invalid sound effect timestamp: ${sfx.timestamp}s (video duration: ${videoDuration}s)`
        );
      }
      if (!['text-appear', 'zoom', 'transition', 'whoosh', 'pop'].includes(sfx.effectType)) {
        throw new Error(`Invalid sound effect type: ${sfx.effectType}`);
      }
      if (sfx.volume < 0 || sfx.volume > 1) {
        throw new Error(`Invalid sound effect volume: ${sfx.volume} (must be 0.0-1.0)`);
      }
      // Enforce volume between 20-30% (0.2-0.3)
      if (sfx.volume < 0.2 || sfx.volume > 0.3) {
        logger.warn('Sound effect volume adjusted to recommended range', {
          original: sfx.volume,
          adjusted: 0.25,
        });
        sfx.volume = 0.25;
      }
    }

    // Validate text highlights
    for (const textHighlight of plan.textHighlights) {
      if (textHighlight.startTime < 0 || textHighlight.startTime + textHighlight.duration > videoDuration) {
        throw new Error(
          `Invalid text highlight timestamp: ${textHighlight.startTime}s + ${textHighlight.duration}s (video duration: ${videoDuration}s)`
        );
      }
      if (textHighlight.duration < 1) {
        logger.warn('Text highlight duration adjusted to minimum 1 second', {
          original: textHighlight.duration,
          adjusted: 1,
        });
        textHighlight.duration = 1;
      }
      if (!textHighlight.text || textHighlight.text.trim() === '') {
        throw new Error('Text highlight must have non-empty text');
      }
      if (!textHighlight.style) {
        throw new Error('Text highlight must have style configuration');
      }
    }

    // Validate text highlight gaps (minimum 500ms between consecutive highlights)
    const sortedTextHighlights = [...plan.textHighlights].sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < sortedTextHighlights.length - 1; i++) {
      const current = sortedTextHighlights[i];
      const next = sortedTextHighlights[i + 1];
      const gap = next.startTime - (current.startTime + current.duration);
      if (gap < 0.5) {
        logger.warn('Text highlight gap too small, adjusting', {
          currentEnd: current.startTime + current.duration,
          nextStart: next.startTime,
          gap,
          minGap: 0.5,
        });
        // Adjust next highlight start time
        next.startTime = current.startTime + current.duration + 0.5;
      }
    }

    // Validate transition duration bounds (300-500ms)
    for (const transition of plan.transitions) {
      if (transition.duration < 300 || transition.duration > 500) {
        logger.warn('Transition duration adjusted to valid range', {
          original: transition.duration,
          adjusted: Math.max(300, Math.min(500, transition.duration)),
        });
        transition.duration = Math.max(300, Math.min(500, transition.duration));
      }
    }

    // Validate consistent transition types
    const transitionTypes = new Set(plan.transitions.map(t => t.type));
    if (transitionTypes.size > 1) {
      logger.warn('Multiple transition types detected, should use consistent type', {
        types: Array.from(transitionTypes),
      });
    }

    // Validate cut filters
    if (plan.cutFilters) {
      const { colorGrading } = plan.cutFilters;
      if (colorGrading.saturation < 0.5 || colorGrading.saturation > 1.5) {
        throw new Error(
          `Invalid saturation: ${colorGrading.saturation} (must be 0.5-1.5)`
        );
      }
      if (colorGrading.contrast < 0.8 || colorGrading.contrast > 1.3) {
        throw new Error(
          `Invalid contrast: ${colorGrading.contrast} (must be 0.8-1.3)`
        );
      }
      if (plan.cutFilters.vignetteIntensity < 0.1 || plan.cutFilters.vignetteIntensity > 0.15) {
        logger.warn('Vignette intensity adjusted to valid range', {
          original: plan.cutFilters.vignetteIntensity,
          adjusted: Math.max(0.1, Math.min(0.15, plan.cutFilters.vignetteIntensity)),
        });
        plan.cutFilters.vignetteIntensity = Math.max(0.1, Math.min(0.15, plan.cutFilters.vignetteIntensity));
      }
    }

    logger.info('Editing plan validation passed', {
      highlights: plan.highlights.length,
      animations: plan.animations.length,
      transitions: plan.transitions.length,
      brollPlacements: plan.brollPlacements.length,
      zoomEffects: plan.zoomEffects.length,
      soundEffects: plan.soundEffects.length,
      textHighlights: plan.textHighlights.length,
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
