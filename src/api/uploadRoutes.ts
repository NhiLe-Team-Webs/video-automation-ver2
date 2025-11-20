import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import os from 'os';
import { VideoUploadHandler } from '../services/videoUploadHandler';
import { createLogger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import * as jobStorage from '../services/jobStorage';
import { getStatus } from '../services/pipelineOrchestrator';

const logger = createLogger('UploadRoutes');

// Configure multer for file uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB max file size
  },
});

const videoUploadHandler = new VideoUploadHandler();

export const uploadRouter = express.Router();

/**
 * POST /api/upload
 * Upload a video file for processing
 */
uploadRouter.post(
  '/upload',
  upload.single('video'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError('No video file provided');
      }

      // Get userId from request (in production, this would come from authentication)
      const userId = req.body.userId || 'anonymous';

      logger.info('Received video upload request', {
        userId,
        filename: req.file.originalname,
        size: req.file.size,
      });

      const result = await videoUploadHandler.uploadVideo(req.file, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Video uploaded successfully and queued for processing',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/upload/status/:jobId
 * Get the status of a video processing job
 */
uploadRouter.get(
  '/status/:jobId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      const job = jobStorage.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Get detailed status from pipeline orchestrator
      const status = getStatus(jobId);

      res.status(200).json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          currentStage: status.currentStage,
          progress: status.progress,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          youtubeUrl: job.finalYoutubeUrl,
          error: job.error,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
