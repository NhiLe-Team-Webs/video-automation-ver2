/**
 * Development Preview Service
 * 
 * Provides real-time preview of animations, transitions, and effects for developers
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { TemplateLoader } from '../../remotion/templateLoader';
import { REMOTION_CONFIG } from '../../remotion/config';
import { getAvailableTransitions } from '../../remotion/transitions';
import { createLogger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const logger = createLogger('PreviewService');

export interface PreviewResult {
  previewUrl: string;
  duration: number;
  thumbnailUrl: string;
}

export interface VideoSegment {
  videoPath: string;
  startTime: number;
  endTime: number;
}

export interface EffectConfig {
  type: 'zoom' | 'highlight-box' | 'text-overlay' | 'color-grade';
  parameters: Record<string, any>;
  startTime: number;
  duration: number;
}

export type TransitionType = 'fade' | 'slide' | 'wipe' | 'zoom';

export interface EditingPlan {
  highlights: Array<{
    startTime: number;
    endTime: number;
    effectType: string;
    parameters: Record<string, any>;
  }>;
  animations: Array<{
    startTime: number;
    duration: number;
    template: string;
    text?: string;
    parameters: Record<string, any>;
  }>;
  transitions: Array<{
    time: number;
    type: string;
    duration: number;
  }>;
  brollPlacements: Array<{
    startTime: number;
    duration: number;
    searchTerm: string;
  }>;
}

export class PreviewService {
  private cacheDir: string;
  private previewCache: Map<string, PreviewResult>;

  constructor(cacheDir: string = path.join(process.cwd(), 'temp', 'previews')) {
    this.cacheDir = cacheDir;
    this.previewCache = new Map();
  }

  /**
   * Initialize preview service
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.info('Preview service initialized', { cacheDir: this.cacheDir });
    } catch (error) {
      logger.error('Failed to initialize preview service', { error });
      throw new AppError('Failed to initialize preview service', 500);
    }
  }

  /**
   * Preview an animation template
   * Requirement 11.2
   */
  async previewAnimation(
    template: string,
    parameters: Record<string, any>
  ): Promise<PreviewResult> {
    logger.info('Generating animation preview', { template, parameters });

    // Validate template exists
    if (!TemplateLoader.templateExists(template)) {
      throw new AppError(`Template '${template}' does not exist`, 400);
    }

    // Check cache
    const cacheKey = this.generateCacheKey('animation', { template, parameters });
    const cached = this.previewCache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached animation preview', { template });
      return cached;
    }

    try {
      // Create a temporary composition for the animation
      const compositionId = `preview-${template}-${Date.now()}`;
      const outputPath = path.join(this.cacheDir, `${compositionId}.mp4`);
      const thumbnailPath = path.join(this.cacheDir, `${compositionId}-thumb.jpg`);

      // Bundle and render the animation
      const bundleLocation = await this.bundlePreviewComposition(template, parameters);
      
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: compositionId,
        inputProps: parameters,
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: parameters,
      });

      // Generate thumbnail
      await this.generateThumbnail(outputPath, thumbnailPath);

      const result: PreviewResult = {
        previewUrl: `/previews/${path.basename(outputPath)}`,
        duration: composition.durationInFrames / composition.fps,
        thumbnailUrl: `/previews/${path.basename(thumbnailPath)}`,
      };

      // Cache the result
      this.previewCache.set(cacheKey, result);

      logger.info('Animation preview generated', { template, outputPath });
      return result;
    } catch (error) {
      logger.error('Failed to generate animation preview', { template, error });
      throw new AppError('Failed to generate animation preview', 500);
    }
  }

  /**
   * Preview a transition between video segments
   * Requirement 11.3
   */
  async previewTransition(
    type: TransitionType,
    videoSegments: VideoSegment[]
  ): Promise<PreviewResult> {
    logger.info('Generating transition preview', { type, segmentCount: videoSegments.length });

    if (videoSegments.length < 2) {
      throw new AppError('At least 2 video segments required for transition preview', 400);
    }

    // Validate transition type
    const availableTransitions = getAvailableTransitions();
    if (!availableTransitions.includes(type as any)) {
      throw new AppError(`Transition type '${type}' is not available`, 400);
    }

    // Check cache
    const cacheKey = this.generateCacheKey('transition', { type, videoSegments });
    const cached = this.previewCache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached transition preview', { type });
      return cached;
    }

    try {
      const compositionId = `preview-transition-${type}-${Date.now()}`;
      const outputPath = path.join(this.cacheDir, `${compositionId}.mp4`);
      const thumbnailPath = path.join(this.cacheDir, `${compositionId}-thumb.jpg`);

      // Bundle and render the transition
      const bundleLocation = await this.bundleTransitionComposition(type, videoSegments);
      
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: compositionId,
        inputProps: { type, segments: videoSegments },
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: { type, segments: videoSegments },
      });

      // Generate thumbnail
      await this.generateThumbnail(outputPath, thumbnailPath);

      const result: PreviewResult = {
        previewUrl: `/previews/${path.basename(outputPath)}`,
        duration: composition.durationInFrames / composition.fps,
        thumbnailUrl: `/previews/${path.basename(thumbnailPath)}`,
      };

      // Cache the result
      this.previewCache.set(cacheKey, result);

      logger.info('Transition preview generated', { type, outputPath });
      return result;
    } catch (error) {
      logger.error('Failed to generate transition preview', { type, error });
      throw new AppError('Failed to generate transition preview', 500);
    }
  }

  /**
   * Preview an effect on a video
   * Requirement 11.4
   */
  async previewEffect(
    effect: EffectConfig,
    videoPath: string
  ): Promise<PreviewResult> {
    logger.info('Generating effect preview', { effect: effect.type, videoPath });

    // Validate video exists
    try {
      await fs.access(videoPath);
    } catch {
      throw new AppError(`Video file not found: ${videoPath}`, 404);
    }

    // Check cache
    const cacheKey = this.generateCacheKey('effect', { effect, videoPath });
    const cached = this.previewCache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached effect preview', { effect: effect.type });
      return cached;
    }

    try {
      const compositionId = `preview-effect-${effect.type}-${Date.now()}`;
      const outputPath = path.join(this.cacheDir, `${compositionId}.mp4`);
      const thumbnailPath = path.join(this.cacheDir, `${compositionId}-thumb.jpg`);

      // Bundle and render the effect
      const bundleLocation = await this.bundleEffectComposition(effect, videoPath);
      
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: compositionId,
        inputProps: { effect, videoPath },
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: { effect, videoPath },
      });

      // Generate thumbnail
      await this.generateThumbnail(outputPath, thumbnailPath);

      const result: PreviewResult = {
        previewUrl: `/previews/${path.basename(outputPath)}`,
        duration: composition.durationInFrames / composition.fps,
        thumbnailUrl: `/previews/${path.basename(thumbnailPath)}`,
      };

      // Cache the result
      this.previewCache.set(cacheKey, result);

      logger.info('Effect preview generated', { effect: effect.type, outputPath });
      return result;
    } catch (error) {
      logger.error('Failed to generate effect preview', { effect: effect.type, error });
      throw new AppError('Failed to generate effect preview', 500);
    }
  }

  /**
   * Preview full video with editing plan
   * Requirement 11.5
   */
  async previewFullVideo(
    editingPlan: EditingPlan,
    videoPath: string
  ): Promise<PreviewResult> {
    logger.info('Generating full video preview', { videoPath });

    // Validate video exists
    try {
      await fs.access(videoPath);
    } catch {
      throw new AppError(`Video file not found: ${videoPath}`, 404);
    }

    // Check cache
    const cacheKey = this.generateCacheKey('full-video', { editingPlan, videoPath });
    const cached = this.previewCache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached full video preview');
      return cached;
    }

    try {
      const compositionId = `preview-full-${Date.now()}`;
      const outputPath = path.join(this.cacheDir, `${compositionId}.mp4`);
      const thumbnailPath = path.join(this.cacheDir, `${compositionId}-thumb.jpg`);

      // Bundle and render the full video
      const bundleLocation = await this.bundleFullVideoComposition(editingPlan, videoPath);
      
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: compositionId,
        inputProps: { editingPlan, videoPath },
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: { editingPlan, videoPath },
      });

      // Generate thumbnail
      await this.generateThumbnail(outputPath, thumbnailPath);

      const result: PreviewResult = {
        previewUrl: `/previews/${path.basename(outputPath)}`,
        duration: composition.durationInFrames / composition.fps,
        thumbnailUrl: `/previews/${path.basename(thumbnailPath)}`,
      };

      // Cache the result
      this.previewCache.set(cacheKey, result);

      logger.info('Full video preview generated', { outputPath });
      return result;
    } catch (error) {
      logger.error('Failed to generate full video preview', { error });
      throw new AppError('Failed to generate full video preview', 500);
    }
  }

  /**
   * Clear preview cache
   */
  async clearCache(): Promise<void> {
    logger.info('Clearing preview cache');
    this.previewCache.clear();
    
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      logger.info('Preview cache cleared');
    } catch (error) {
      logger.error('Failed to clear preview cache', { error });
    }
  }

  /**
   * Generate cache key for preview
   */
  private generateCacheKey(type: string, data: any): string {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify({ type, data }));
    return hash.digest('hex');
  }

  /**
   * Bundle preview composition for animation
   */
  private async bundlePreviewComposition(
    template: string,
    parameters: Record<string, any>
  ): Promise<string> {
    // For now, return a placeholder - actual bundling would require
    // creating a temporary Remotion project structure
    const bundleDir = path.join(this.cacheDir, 'bundles', `animation-${template}`);
    await fs.mkdir(bundleDir, { recursive: true });
    
    // In a real implementation, we would:
    // 1. Create a temporary entry point that imports the template
    // 2. Bundle it using @remotion/bundler
    // 3. Return the bundle location
    
    return bundleDir;
  }

  /**
   * Bundle preview composition for transition
   */
  private async bundleTransitionComposition(
    type: TransitionType,
    videoSegments: VideoSegment[]
  ): Promise<string> {
    const bundleDir = path.join(this.cacheDir, 'bundles', `transition-${type}`);
    await fs.mkdir(bundleDir, { recursive: true });
    return bundleDir;
  }

  /**
   * Bundle preview composition for effect
   */
  private async bundleEffectComposition(
    effect: EffectConfig,
    videoPath: string
  ): Promise<string> {
    const bundleDir = path.join(this.cacheDir, 'bundles', `effect-${effect.type}`);
    await fs.mkdir(bundleDir, { recursive: true });
    return bundleDir;
  }

  /**
   * Bundle preview composition for full video
   */
  private async bundleFullVideoComposition(
    editingPlan: EditingPlan,
    videoPath: string
  ): Promise<string> {
    const bundleDir = path.join(this.cacheDir, 'bundles', 'full-video');
    await fs.mkdir(bundleDir, { recursive: true });
    return bundleDir;
  }

  /**
   * Generate thumbnail from video
   */
  private async generateThumbnail(videoPath: string, thumbnailPath: string): Promise<void> {
    // Placeholder - would use FFmpeg to extract a frame
    // For now, just create an empty file
    await fs.writeFile(thumbnailPath, '');
  }
}
