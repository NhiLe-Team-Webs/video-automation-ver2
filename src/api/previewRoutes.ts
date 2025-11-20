/**
 * Preview API Routes
 * 
 * HTTP endpoints for development preview service
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import express, { Request, Response, NextFunction } from 'express';
import { PreviewService, EffectConfig, VideoSegment, TransitionType, EditingPlan } from '../services/preview/previewService';
import { createLogger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { TemplateLoader } from '../remotion/templateLoader';
import { AVAILABLE_TRANSITIONS } from '../remotion/transitions';
import path from 'path';

const logger = createLogger('PreviewRoutes');
const previewService = new PreviewService();

export const previewRouter = express.Router();

// Initialize preview service
previewService.initialize().catch(error => {
  logger.error('Failed to initialize preview service', { error });
});

/**
 * POST /api/preview/animation
 * Preview an animation template
 */
previewRouter.post('/animation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { template, parameters } = req.body;

    if (!template) {
      throw new AppError('Template name is required', 400);
    }

    if (!parameters || typeof parameters !== 'object') {
      throw new AppError('Parameters object is required', 400);
    }

    logger.info('Animation preview requested', { template });

    const result = await previewService.previewAnimation(template, parameters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/preview/transition
 * Preview a transition between video segments
 */
previewRouter.post('/transition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, videoSegments } = req.body;

    if (!type) {
      throw new AppError('Transition type is required', 400);
    }

    if (!Array.isArray(videoSegments) || videoSegments.length < 2) {
      throw new AppError('At least 2 video segments are required', 400);
    }

    // Validate video segments
    for (const segment of videoSegments) {
      if (!segment.videoPath || typeof segment.startTime !== 'number' || typeof segment.endTime !== 'number') {
        throw new AppError('Invalid video segment format', 400);
      }
    }

    logger.info('Transition preview requested', { type, segmentCount: videoSegments.length });

    const result = await previewService.previewTransition(type as TransitionType, videoSegments as VideoSegment[]);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/preview/effect
 * Preview an effect on a video
 */
previewRouter.post('/effect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { effect, videoPath } = req.body;

    if (!effect || typeof effect !== 'object') {
      throw new AppError('Effect configuration is required', 400);
    }

    if (!videoPath) {
      throw new AppError('Video path is required', 400);
    }

    // Validate effect config
    if (!effect.type || typeof effect.startTime !== 'number' || typeof effect.duration !== 'number') {
      throw new AppError('Invalid effect configuration', 400);
    }

    logger.info('Effect preview requested', { effectType: effect.type, videoPath });

    const result = await previewService.previewEffect(effect as EffectConfig, videoPath);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/preview/full-video
 * Preview full video with editing plan
 */
previewRouter.post('/full-video', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { editingPlan, videoPath } = req.body;

    if (!editingPlan || typeof editingPlan !== 'object') {
      throw new AppError('Editing plan is required', 400);
    }

    if (!videoPath) {
      throw new AppError('Video path is required', 400);
    }

    // Validate editing plan structure
    if (!Array.isArray(editingPlan.highlights) || 
        !Array.isArray(editingPlan.animations) || 
        !Array.isArray(editingPlan.transitions) || 
        !Array.isArray(editingPlan.brollPlacements)) {
      throw new AppError('Invalid editing plan structure', 400);
    }

    logger.info('Full video preview requested', { videoPath });

    const result = await previewService.previewFullVideo(editingPlan as EditingPlan, videoPath);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/preview/cache
 * Clear preview cache
 */
previewRouter.delete('/cache', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Cache clear requested');

    await previewService.clearCache();

    res.status(200).json({
      success: true,
      message: 'Preview cache cleared',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/preview/templates
 * Get list of available animation templates
 */
previewRouter.get('/templates', (_req: Request, res: Response) => {
  try {
    const templates = TemplateLoader.getAllTemplateInfo();

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    logger.error('Failed to get templates', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve templates',
    });
  }
});

/**
 * GET /api/preview/transitions
 * Get list of available transitions
 */
previewRouter.get('/transitions', (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: AVAILABLE_TRANSITIONS,
    });
  } catch (error) {
    logger.error('Failed to get transitions', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transitions',
    });
  }
});

/**
 * Error handler for preview routes
 */
export function previewErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    logger.warn('Preview API error', {
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  logger.error('Unexpected preview API error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
