import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { VideoUploadHandler } from '../services/upload/videoUploadHandler';
import { createLogger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import * as jobStorage from '../services/pipeline/jobStorage';
import { getStatus } from '../services/pipeline/pipelineOrchestrator';
import { config } from '../config';

const logger = createLogger('UploadRoutes');

// Ensure upload directory exists
const uploadDir = path.join(config.storage.tempDir, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads with proper filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original extension
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
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
      
      logger.info('Upload response sent', {
        jobId: result.jobId,
        status: result.status,
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

      const job = await jobStorage.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Get detailed status from pipeline orchestrator
      const status = await getStatus(jobId);

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
 * GET /api/jobs/:jobId/status
 * Get the status of a video processing job (alternative endpoint)
 * Returns current pipeline stage and progress percentage
 * Includes estimated time remaining
 */
uploadRouter.get(
  '/jobs/:jobId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      const job = await jobStorage.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Get detailed status from pipeline orchestrator
      const status = await getStatus(jobId);

      // Calculate estimated time remaining
      // Based on elapsed time and progress percentage
      const elapsedTime = new Date().getTime() - job.createdAt.getTime();
      const estimatedTotalTime = status.progress > 0 
        ? Math.round(elapsedTime / (status.progress / 100))
        : 0;
      const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);

      res.status(200).json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          currentStage: status.currentStage,
          progress: status.progress,
          elapsedTimeMs: elapsedTime,
          estimatedTimeRemainingMs: estimatedTimeRemaining,
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
 * GET /api/jobs/:jobId/download
 * Download the final processed video file
 * Streams the final video file to the user
 * Sets proper content-type and headers
 */
uploadRouter.get(
  '/jobs/:jobId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      const job = await jobStorage.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Check if job is completed
      if (job.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: `Job is not completed. Current status: ${job.status}`,
        });
      }

      // Find the rendering stage output (final video)
      const renderingStage = job.processingStages.find(s => s.stage === 'rendering');
      
      if (!renderingStage || !renderingStage.outputPath) {
        return res.status(404).json({
          success: false,
          error: 'Final video file not found',
        });
      }

      const videoPath = renderingStage.outputPath;

      // Check if file exists
      if (!fs.existsSync(videoPath)) {
        logger.error('Video file not found on disk', {
          jobId,
          videoPath,
        });
        return res.status(404).json({
          success: false,
          error: 'Video file not found on disk',
        });
      }

      // Get file stats
      const stats = fs.statSync(videoPath);
      const filename = `${jobId}_final.mp4`;

      // Set response headers for video download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stats.size);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      logger.info('Starting video download', {
        jobId,
        videoPath,
        fileSize: stats.size,
        filename,
      });

      // Stream the file
      const fileStream = fs.createReadStream(videoPath);

      fileStream.on('error', (error) => {
        logger.error('Error streaming video file', {
          jobId,
          videoPath,
          error: error.message,
        });
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error streaming video file',
          });
        }
      });

      fileStream.pipe(res);
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
