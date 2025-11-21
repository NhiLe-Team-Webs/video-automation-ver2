import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../utils/logger';
import { ProcessingError } from '../../utils/errors';
import { config } from '../../config';
import { EditingPlan } from '../content-analysis/editingPlanService';
import { REMOTION_CONFIG, secondsToFrames } from '../../remotion/config';
import { TemplateLoader } from '../../remotion/templateLoader';

const logger = createLogger('RemotionRenderingService');

export interface RenderInput {
  videoPath: string;
  editingPlan: EditingPlan;
  outputPath: string;
  srtPath?: string;
  brollVideos?: BrollVideoMapping[];
}

export interface BrollVideoMapping {
  startTime: number;
  duration: number;
  videoPath: string;
}

export interface RenderResult {
  outputPath: string;
  duration: number;
  fileSize: number;
}

/**
 * Remotion Rendering Service
 * 
 * Applies animations, effects, B-roll, and subtitles to videos using Remotion
 */
export class RemotionRenderingService {
  private readonly tempDir: string;

  constructor() {
    this.tempDir = config.storage.tempDir;
  }

  /**
   * Render video with editing plan
   */
  async renderVideo(input: RenderInput): Promise<RenderResult> {
    const jobId = `render-${Date.now()}`;

    logger.info('Starting video rendering', {
      jobId,
      videoPath: input.videoPath,
      outputPath: input.outputPath,
      animations: input.editingPlan.animations.length,
      transitions: input.editingPlan.transitions.length,
      brollPlacements: input.editingPlan.brollPlacements.length,
      highlights: input.editingPlan.highlights.length,
    });

    try {
      // Validate input
      await this.validateInput(input);

      // Get video metadata
      const videoMetadata = await this.getVideoMetadata(input.videoPath);

      logger.info('Video metadata extracted', {
        jobId,
        duration: videoMetadata.duration,
        width: videoMetadata.width,
        height: videoMetadata.height,
      });

      // Validate editing plan timestamps
      this.validateEditingPlanTimestamps(input.editingPlan, videoMetadata.duration);

      // Parse subtitles if provided
      let subtitles: SubtitleSegment[] = [];
      if (input.srtPath) {
        subtitles = await this.parseSRT(input.srtPath);
        logger.info('Subtitles parsed', {
          jobId,
          segments: subtitles.length,
        });
      }

      // Create composition data
      const compositionData = this.createCompositionData(
        input,
        videoMetadata,
        subtitles
      );

      // Bundle Remotion project
      logger.info('Bundling Remotion project', { jobId });
      const bundleLocation = await this.bundleRemotionProject();

      // Get composition
      logger.info('Selecting composition', { jobId });
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: 'VideoComposition',
        inputProps: compositionData as unknown as Record<string, unknown>,
      });

      // Ensure output directory exists
      const outputDir = path.dirname(input.outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Render video
      logger.info('Rendering video', {
        jobId,
        composition: composition.id,
        durationInFrames: composition.durationInFrames,
        fps: composition.fps,
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: input.outputPath,
        inputProps: compositionData as unknown as Record<string, unknown>,
        onProgress: ({ progress, renderedFrames, encodedFrames }) => {
          if (renderedFrames % 30 === 0) {
            logger.debug('Rendering progress', {
              jobId,
              progress: `${(progress * 100).toFixed(1)}%`,
              renderedFrames,
              encodedFrames,
            });
          }
        },
      });

      // Get output file stats
      const stats = await fs.stat(input.outputPath);

      logger.info('Video rendering completed', {
        jobId,
        outputPath: input.outputPath,
        fileSize: stats.size,
        duration: videoMetadata.duration,
      });

      return {
        outputPath: input.outputPath,
        duration: videoMetadata.duration,
        fileSize: stats.size,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Video rendering failed', {
        jobId,
        error: errorMessage,
        stack: errorStack,
        videoPath: input.videoPath,
        outputPath: input.outputPath,
      });

      throw new ProcessingError(`Video rendering failed: ${errorMessage}`, {
        jobId,
        stage: 'rendering',
        attemptNumber: 1,
      });
    }
  }

  /**
   * Validate input parameters
   */
  private async validateInput(input: RenderInput): Promise<void> {
    // Check video file exists
    try {
      await fs.access(input.videoPath);
    } catch {
      throw new Error(`Video file not found: ${input.videoPath}`);
    }

    // Check SRT file exists if provided
    if (input.srtPath) {
      try {
        await fs.access(input.srtPath);
      } catch {
        throw new Error(`SRT file not found: ${input.srtPath}`);
      }
    }

    // Check B-roll videos exist if provided
    if (input.brollVideos) {
      for (const broll of input.brollVideos) {
        try {
          await fs.access(broll.videoPath);
        } catch {
          throw new Error(`B-roll video not found: ${broll.videoPath}`);
        }
      }
    }

    // Validate animation templates exist
    for (const animation of input.editingPlan.animations) {
      if (!TemplateLoader.templateExists(animation.template)) {
        throw new Error(
          `Animation template does not exist: ${animation.template}`
        );
      }
    }
  }

  /**
   * Get video metadata using FFprobe
   */
  private async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);

    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,duration',
        '-show_entries',
        'format=duration',
        '-of',
        'json',
        videoPath,
      ]);

      const data = JSON.parse(stdout);
      const stream = data.streams[0];
      const format = data.format;

      return {
        width: stream.width,
        height: stream.height,
        duration: parseFloat(format.duration || stream.duration),
      };
    } catch (error) {
      throw new Error(`Failed to get video metadata: ${error}`);
    }
  }

  /**
   * Validate editing plan timestamps against video duration
   */
  private validateEditingPlanTimestamps(
    plan: EditingPlan,
    videoDuration: number
  ): void {
    const tolerance = 0.1; // 100ms tolerance

    // Validate animations
    for (const animation of plan.animations) {
      const endTime = animation.startTime + animation.duration;
      if (endTime > videoDuration + tolerance) {
        logger.warn('Animation extends beyond video duration', {
          animationEnd: endTime,
          videoDuration,
          template: animation.template,
        });
      }
    }

    // Validate highlights
    for (const highlight of plan.highlights) {
      if (highlight.endTime > videoDuration + tolerance) {
        logger.warn('Highlight extends beyond video duration', {
          highlightEnd: highlight.endTime,
          videoDuration,
          effectType: highlight.effectType,
        });
      }
    }

    // Validate B-roll placements
    for (const broll of plan.brollPlacements) {
      const endTime = broll.startTime + broll.duration;
      if (endTime > videoDuration + tolerance) {
        logger.warn('B-roll extends beyond video duration', {
          brollEnd: endTime,
          videoDuration,
          searchTerm: broll.searchTerm,
        });
      }
    }
  }

  /**
   * Parse SRT subtitle file
   */
  private async parseSRT(srtPath: string): Promise<SubtitleSegment[]> {
    const content = await fs.readFile(srtPath, 'utf-8');
    const segments: SubtitleSegment[] = [];

    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      const timeLine = lines[1];
      const textLines = lines.slice(2);

      // Parse timestamp: 00:00:01,000 --> 00:00:03,000
      const timeMatch = timeLine.match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
      );

      if (timeMatch) {
        const startTime =
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]) +
          parseInt(timeMatch[4]) / 1000;

        const endTime =
          parseInt(timeMatch[5]) * 3600 +
          parseInt(timeMatch[6]) * 60 +
          parseInt(timeMatch[7]) +
          parseInt(timeMatch[8]) / 1000;

        segments.push({
          startTime,
          endTime,
          text: textLines.join(' '),
        });
      }
    }

    return segments;
  }

  /**
   * Create composition data for Remotion
   */
  private createCompositionData(
    input: RenderInput,
    videoMetadata: VideoMetadata,
    subtitles: SubtitleSegment[]
  ): CompositionData {
    return {
      videoPath: input.videoPath,
      videoDuration: videoMetadata.duration,
      videoWidth: videoMetadata.width,
      videoHeight: videoMetadata.height,
      editingPlan: input.editingPlan,
      subtitles,
      brollVideos: input.brollVideos || [],
    };
  }

  /**
   * Bundle Remotion project
   */
  private async bundleRemotionProject(): Promise<string> {
    const remotionRoot = path.join(__dirname, '../../remotion');
    const bundleDir = path.join(this.tempDir, 'remotion-bundle');

    await fs.mkdir(bundleDir, { recursive: true });

    const bundleLocation = await bundle({
      entryPoint: path.join(remotionRoot, 'index.ts'),
      outDir: bundleDir,
      webpackOverride: (config) => config,
    });

    return bundleLocation;
  }
}

// Type definitions
interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

interface SubtitleSegment {
  startTime: number;
  endTime: number;
  text: string;
}

interface CompositionData {
  videoPath: string;
  videoDuration: number;
  videoWidth: number;
  videoHeight: number;
  editingPlan: EditingPlan;
  subtitles: SubtitleSegment[];
  brollVideos: BrollVideoMapping[];
}

export default new RemotionRenderingService();
