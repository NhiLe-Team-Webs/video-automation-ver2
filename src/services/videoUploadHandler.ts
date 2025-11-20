import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import {
  VideoMetadata,
  ValidationResult,
  UploadResult,
  Job,
  StageResult,
} from '../models/job';
import * as jobStorage from './jobStorage';
import { addVideoJob } from './queue';

const logger = createLogger('VideoUploadHandler');

const SUPPORTED_FORMATS = ['mp4', 'mov', 'avi', 'mkv'];

export class VideoUploadHandler {

  /**
   * Upload and validate a video file
   */
  async uploadVideo(file: Express.Multer.File, userId: string): Promise<UploadResult> {
    const jobId = uuidv4();
    
    logger.info('Starting video upload', {
      jobId,
      userId,
      filename: file.originalname,
      size: file.size,
    });

    try {
      // Validate the video file
      const validationResult = await this.validateVideo(file);
      
      if (!validationResult.isValid) {
        logger.error('Video validation failed', {
          jobId,
          errors: validationResult.errors,
        });
        throw new ValidationError(
          `Video validation failed: ${validationResult.errors.join(', ')}`,
          { jobId, stage: 'uploaded', attemptNumber: 0 }
        );
      }

      // Move file to permanent storage
      const videoPath = await this.storeVideo(file, jobId);

      // Create job record in storage
      const job = jobStorage.createJob(jobId, userId, validationResult.metadata!);
      
      // Mark uploaded stage as completed
      jobStorage.updateStage(jobId, 'uploaded', 'completed', videoPath);

      // Add job to processing queue
      await addVideoJob({
        jobId,
        userId,
        videoPath,
      });

      logger.info('Video uploaded successfully and queued for processing', {
        jobId,
        videoPath,
        metadata: validationResult.metadata,
      });

      return {
        jobId,
        videoPath,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Video upload failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Validate video file format and integrity
   */
  async validateVideo(file: Express.Multer.File): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      // Check if file exists
      if (!file || !file.path) {
        errors.push('No file provided');
        return { isValid: false, errors };
      }

      // Extract format from filename
      const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
      
      // Validate format
      if (!SUPPORTED_FORMATS.includes(fileExtension)) {
        errors.push(
          `Unsupported video format: ${fileExtension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
        );
      }

      // Extract metadata and verify file integrity
      const metadata = await this.extractMetadata(file.path);
      
      // Verify the format matches what ffmpeg detected
      if (metadata.format && !SUPPORTED_FORMATS.includes(metadata.format)) {
        errors.push(
          `Video format mismatch or corrupted file. Detected format: ${metadata.format}`
        );
      }

      // Check if video has valid duration
      if (metadata.duration <= 0) {
        errors.push('Invalid video duration');
      }

      // Check if video has valid resolution
      if (metadata.resolution.width <= 0 || metadata.resolution.height <= 0) {
        errors.push('Invalid video resolution');
      }

      // Calculate checksum for integrity
      const checksum = await this.calculateChecksum(file.path);
      metadata.checksum = checksum;

      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      return {
        isValid: true,
        errors: [],
        metadata,
      };
    } catch (error) {
      logger.error('Error during video validation', {
        error: error instanceof Error ? error.message : String(error),
      });
      errors.push('Failed to validate video file. File may be corrupted.');
      return { isValid: false, errors };
    }
  }

  /**
   * Extract video metadata using ffmpeg
   */
  private async extractMetadata(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === 'video'
        );

        if (!videoStream) {
          reject(new Error('No video stream found in file'));
          return;
        }

        const format = metadata.format.format_name?.split(',')[0] || 'unknown';
        const duration = metadata.format.duration || 0;
        const fileSize = metadata.format.size || 0;
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;

        resolve({
          duration,
          resolution: { width, height },
          format,
          fileSize,
          checksum: '', // Will be set later
        });
      });
    });
  }

  /**
   * Calculate file checksum for integrity verification
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('md5');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  /**
   * Store video file in permanent storage
   */
  private async storeVideo(file: Express.Multer.File, jobId: string): Promise<string> {
    const fileExtension = path.extname(file.originalname);
    const filename = `${jobId}${fileExtension}`;
    const destPath = path.join(config.storage.tempDir, filename);

    // Ensure temp directory exists
    await fs.mkdir(config.storage.tempDir, { recursive: true });

    // Copy file to permanent location (use copyFile instead of rename for cross-device support)
    try {
      await fs.copyFile(file.path, destPath);
      // Delete original temp file after successful copy
      await fs.unlink(file.path);
    } catch (error) {
      // If copy fails, try rename as fallback (for same device)
      await fs.rename(file.path, destPath);
    }

    return destPath;
  }

}
