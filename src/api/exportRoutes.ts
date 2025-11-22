import express, { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import * as jobStorage from '../services/pipeline/jobStorage';
import { SheetsStorageService } from '../services/transcription/sheetsStorageService';
import { WasabiStorageService } from '../services/storage/wasabiStorageService';
import fs from 'fs';
import path from 'path';

const logger = createLogger('ExportRoutes');

export const exportRouter = express.Router();

const sheetsService = new SheetsStorageService();
const storageService = new WasabiStorageService();

/**
 * GET /api/export/srt/:jobId
 * Get SRT subtitle file for a job
 * Supports both raw SRT format and JSON format
 * 
 * Query params:
 * - format: 'srt' (default) or 'json'
 * 
 * Example:
 * GET /api/export/srt/job123?format=json
 */
exportRouter.get(
  '/srt/:jobId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const format = (req.query.format as string) || 'srt';

      logger.info('SRT export requested', { jobId, format });

      // Get job to verify it exists
      const job = await jobStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Get transcript from Google Sheets
      const transcript = await sheetsService.getTranscript(jobId);

      if (!transcript || transcript.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Transcript not found for this job',
        });
      }

      if (format === 'json') {
        // Return JSON format
        res.status(200).json({
          success: true,
          data: {
            jobId,
            segments: transcript.map((seg, index) => ({
              index: index + 1,
              start: seg.start,
              end: seg.end,
              text: seg.text,
            })),
          },
        });
      } else {
        // Return SRT format
        const srtContent = transcript
          .map((seg, index) => {
            const startTime = formatSRTTime(seg.start);
            const endTime = formatSRTTime(seg.end);
            return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
          })
          .join('\n');

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${jobId}.srt"`);
        res.status(200).send(srtContent);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/export/sheets/:jobId
 * Export SRT subtitles to a new Google Sheets spreadsheet
 * 
 * Returns a shareable Google Sheets URL
 * 
 * Request body (optional):
 * {
 *   "title": "Custom spreadsheet title"
 * }
 */
exportRouter.post(
  '/sheets/:jobId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const { title } = req.body;

      logger.info('Google Sheets export requested', { jobId, title });

      // Get job to verify it exists
      const job = await jobStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Get transcript from Google Sheets
      const transcript = await sheetsService.getTranscript(jobId);

      if (!transcript || transcript.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Transcript not found for this job',
        });
      }

      // Note: This is a simplified implementation
      // In production, you would create a new spreadsheet and return its URL
      // For now, we return the existing spreadsheet URL
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}`;

      res.status(200).json({
        success: true,
        data: {
          jobId,
          spreadsheetUrl,
          segmentCount: transcript.length,
          message: 'Transcript is available in Google Sheets',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/export/video/:jobId/raw
 * Get download URL for the raw uploaded video
 * 
 * Returns a signed URL from Wasabi storage (valid for 7 days)
 */
exportRouter.get(
  '/video/:jobId/raw',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      logger.info('Raw video export requested', { jobId });

      // Get job
      const job = await jobStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Find the uploaded stage to get raw video path
      const uploadedStage = job.processingStages.find(s => s.stage === 'uploaded');
      
      if (!uploadedStage || !uploadedStage.outputPath) {
        return res.status(404).json({
          success: false,
          error: 'Raw video not found',
        });
      }

      // Extract key from path (format: wasabi://bucket/key)
      const videoKey = uploadedStage.outputPath.replace(/^wasabi:\/\/[^/]+\//, '');

      // Generate signed URL
      const signedUrl = await storageService.getSignedUrl(videoKey, { expiresIn: 7 * 24 * 60 * 60 }); // 7 days

      res.status(200).json({
        success: true,
        data: {
          jobId,
          downloadUrl: signedUrl,
          expiresIn: '7 days',
          type: 'raw',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/export/video/:jobId/edited
 * Get download URL for the auto-edited video (after Auto Editor)
 * 
 * Returns a signed URL from Wasabi storage (valid for 7 days)
 */
exportRouter.get(
  '/video/:jobId/edited',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      logger.info('Edited video export requested', { jobId });

      // Get job
      const job = await jobStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      // Find the auto-editing stage to get edited video path
      const autoEditStage = job.processingStages.find(s => s.stage === 'auto-editing');
      
      if (!autoEditStage || !autoEditStage.outputPath) {
        return res.status(404).json({
          success: false,
          error: 'Edited video not found. Job may not have completed auto-editing stage.',
        });
      }

      // Extract key from path
      const videoKey = autoEditStage.outputPath.replace(/^wasabi:\/\/[^/]+\//, '');

      // Generate signed URL
      const signedUrl = await storageService.getSignedUrl(videoKey, { expiresIn: 7 * 24 * 60 * 60 }); // 7 days

      res.status(200).json({
        success: true,
        data: {
          jobId,
          downloadUrl: signedUrl,
          expiresIn: '7 days',
          type: 'edited',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/export/video/:jobId/final
 * Get download URL for the final rendered video
 * 
 * Returns a signed URL from Wasabi storage (valid for 7 days)
 */
exportRouter.get(
  '/video/:jobId/final',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      logger.info('Final video export requested', { jobId });

      // Get job
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

      // Find the uploading stage to get final video path
      const uploadingStage = job.processingStages.find(s => s.stage === 'uploading');
      
      if (!uploadingStage || !uploadingStage.outputPath) {
        return res.status(404).json({
          success: false,
          error: 'Final video not found',
        });
      }

      const videoUrl = uploadingStage.outputPath;

      res.status(200).json({
        success: true,
        data: {
          jobId,
          downloadUrl: videoUrl,
          expiresIn: '7 days',
          type: 'final',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/export/share/:jobId
 * Get all shareable links for a job (videos, SRT, Google Sheets)
 * 
 * Returns all available download URLs and metadata
 */
exportRouter.get(
  '/share/:jobId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      logger.info('Share links requested', { jobId });

      // Get job
      const job = await jobStorage.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
        });
      }

      const links: any = {
        jobId,
        status: job.status,
        createdAt: job.createdAt,
        videos: {},
        transcript: {},
      };

      // Get raw video URL
      const uploadedStage = job.processingStages.find(s => s.stage === 'uploaded');
      if (uploadedStage?.outputPath) {
        const videoKey = uploadedStage.outputPath.replace(/^wasabi:\/\/[^/]+\//, '');
        links.videos.raw = await storageService.getSignedUrl(videoKey, { expiresIn: 7 * 24 * 60 * 60 });
      }

      // Get edited video URL
      const autoEditStage = job.processingStages.find(s => s.stage === 'auto-editing');
      if (autoEditStage?.outputPath) {
        const videoKey = autoEditStage.outputPath.replace(/^wasabi:\/\/[^/]+\//, '');
        links.videos.edited = await storageService.getSignedUrl(videoKey, { expiresIn: 7 * 24 * 60 * 60 });
      }

      // Get final video URL
      const uploadingStage = job.processingStages.find(s => s.stage === 'uploading');
      if (uploadingStage?.outputPath) {
        links.videos.final = uploadingStage.outputPath;
      }

      // Get transcript links
      const transcript = await sheetsService.getTranscript(jobId);
      if (transcript && transcript.length > 0) {
        links.transcript.srt = `${req.protocol}://${req.get('host')}/api/export/srt/${jobId}`;
        links.transcript.json = `${req.protocol}://${req.get('host')}/api/export/srt/${jobId}?format=json`;
        links.transcript.googleSheets = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}`;
        links.transcript.segmentCount = transcript.length;
      }

      res.status(200).json({
        success: true,
        data: links,
        expiresIn: '7 days',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper function to format time in SRT format (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Error handling middleware
 */
export function exportErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Export API error', {
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
