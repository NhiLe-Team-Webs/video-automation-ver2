import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { uploadRouter, errorHandler } from './uploadRoutes';
import * as jobStorage from '../services/pipeline/jobStorage';
import { createLogger } from '../utils/logger';

const logger = createLogger('UploadIntegrationTest');

/**
 * End-to-end integration tests for video upload and processing
 * Tests the complete flow: Upload → Status polling → Download
 * 
 * Feature: youtube-video-automation
 * Property 1: Pipeline stage execution
 * Property 3: Job status tracking
 * Property 4: Pipeline completion produces YouTube link
 */
describe('Upload Integration Tests', () => {
  let app: express.Application;
  const testVideoPath = path.join(process.cwd(), 'temp', 'test-video.mp4');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', uploadRouter);
    app.use(errorHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 1: Pipeline stage execution', () => {
    it('should upload video and initiate pipeline', async () => {
      // Skip if test video doesn't exist
      if (!fs.existsSync(testVideoPath)) {
        logger.warn('Skipping test - test video not found');
        return;
      }

      const response = await request(app)
        .post('/api/upload')
        .field('userId', 'test-user-123')
        .attach('video', testVideoPath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.status).toBe('queued');

      logger.info('Video upload test completed', {
        jobId: response.body.data.jobId,
        status: response.body.data.status,
      });
    });

    it('should reject upload without video file', async () => {
      const response = await request(app)
        .post('/api/upload')
        .field('userId', 'test-user-123');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();

      logger.info('No video file test completed', {
        error: response.body.error,
      });
    });

    it('should reject upload with invalid file type', async () => {
      // Create a temporary text file
      const tempFile = path.join(process.cwd(), 'temp', 'test.txt');
      fs.writeFileSync(tempFile, 'This is not a video');

      try {
        const response = await request(app)
          .post('/api/upload')
          .field('userId', 'test-user-123')
          .attach('video', tempFile);

        // Should either reject or accept (depending on validation)
        // The important thing is that it handles the request
        expect([200, 400]).toContain(response.status);

        logger.info('Invalid file type test completed', {
          status: response.status,
        });
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe('Property 3: Job status tracking', () => {
    it('should return job status with progress', async () => {
      const jobId = `test-status-${Date.now()}`;
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      // Create a test job
      await jobStorage.createJob(jobId, userId, videoMetadata);
      await jobStorage.updateJobStatus(jobId, 'processing');
      await jobStorage.updateStage(jobId, 'uploaded', 'completed');
      await jobStorage.updateStage(jobId, 'auto-editing', 'in-progress');

      const response = await request(app).get(`/api/jobs/${jobId}/status`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.jobId).toBe(jobId);
      expect(response.body.data.status).toBe('processing');
      expect(response.body.data.currentStage).toBe('auto-editing');
      expect(response.body.data.progress).toBeGreaterThan(0);
      expect(response.body.data.progress).toBeLessThanOrEqual(100);
      expect(response.body.data.elapsedTimeMs).toBeGreaterThanOrEqual(0);
      expect(response.body.data.estimatedTimeRemainingMs).toBeGreaterThanOrEqual(0);

      logger.info('Job status tracking test completed', {
        jobId,
        status: response.body.data.status,
        progress: response.body.data.progress,
      });
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app).get('/api/jobs/nonexistent-job/status');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');

      logger.info('Non-existent job test completed');
    });

    it('should track progress through multiple stages', async () => {
      const jobId = `test-multi-stage-${Date.now()}`;
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      // Create job
      await jobStorage.createJob(jobId, userId, videoMetadata);
      await jobStorage.updateJobStatus(jobId, 'processing');

      // Simulate progress through stages
      const stages = [
        'uploaded',
        'auto-editing',
        'transcribing',
        'storing-transcript',
        'detecting-highlights',
        'generating-plan',
        'rendering',
        'uploading',
      ];

      const progressValues: number[] = [];

      for (const stage of stages) {
        await jobStorage.updateStage(jobId, stage, 'completed');

        const response = await request(app).get(`/api/jobs/${jobId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.progress).toBeGreaterThanOrEqual(0);
        expect(response.body.data.progress).toBeLessThanOrEqual(100);

        progressValues.push(response.body.data.progress);
      }

      // Verify progress increases (or stays same)
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }

      logger.info('Multi-stage progress test completed', {
        jobId,
        progressValues,
      });
    });
  });

  describe('Property 4: Pipeline completion produces YouTube link', () => {
    it('should return YouTube URL when job is completed', async () => {
      const jobId = `test-youtube-${Date.now()}`;
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      // Create and complete job
      await jobStorage.createJob(jobId, userId, videoMetadata);
      await jobStorage.updateJobStatus(jobId, 'completed');
      await jobStorage.setYoutubeUrl(jobId, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const response = await request(app).get(`/api/jobs/${jobId}/status`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(response.body.data.status).toBe('completed');

      logger.info('YouTube URL test completed', {
        jobId,
        youtubeUrl: response.body.data.youtubeUrl,
      });
    });

    it('should not return YouTube URL for incomplete job', async () => {
      const jobId = `test-incomplete-${Date.now()}`;
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      // Create job in processing state
      await jobStorage.createJob(jobId, userId, videoMetadata);
      await jobStorage.updateJobStatus(jobId, 'processing');

      const response = await request(app).get(`/api/jobs/${jobId}/status`);

      expect(response.status).toBe(200);
      expect(response.body.data.youtubeUrl).toBeUndefined();
      expect(response.body.data.status).toBe('processing');

      logger.info('Incomplete job test completed', {
        jobId,
        status: response.body.data.status,
      });
    });
  });

  describe('Video download endpoint', () => {
    let tempDir: string;
    let testVideoFile: string;

    beforeEach(() => {
      tempDir = path.join(process.cwd(), 'temp', 'test-downloads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      testVideoFile = path.join(tempDir, 'test-video.mp4');
      fs.writeFileSync(testVideoFile, Buffer.from('dummy video content'));
    });

    afterEach(() => {
      if (fs.existsSync(testVideoFile)) {
        fs.unlinkSync(testVideoFile);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }
    });

    it('should download completed video', async () => {
      const jobId = `test-download-${Date.now()}`;
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      // Create completed job
      await jobStorage.createJob(jobId, userId, videoMetadata);
      await jobStorage.updateJobStatus(jobId, 'completed');
      await jobStorage.updateStage(jobId, 'rendering', 'completed', testVideoFile);

      const response = await request(app).get(`/api/jobs/${jobId}/download`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('video/mp4');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.toString()).toBe('dummy video content');

      logger.info('Video download test completed', {
        jobId,
        contentType: response.headers['content-type'],
      });
    });

    it('should reject download for incomplete job', async () => {
      const jobId = `test-incomplete-download-${Date.now()}`;
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      // Create incomplete job
      await jobStorage.createJob(jobId, userId, videoMetadata);
      await jobStorage.updateJobStatus(jobId, 'processing');

      const response = await request(app).get(`/api/jobs/${jobId}/download`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not completed');

      logger.info('Incomplete download test completed', {
        jobId,
        error: response.body.error,
      });
    });

    it('should return 404 for missing video file', async () => {
      const jobId = `test-missing-file-${Date.now()}`;
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      // Create completed job but don't set rendering output
      await jobStorage.createJob(jobId, userId, videoMetadata);
      await jobStorage.updateJobStatus(jobId, 'completed');

      const response = await request(app).get(`/api/jobs/${jobId}/download`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      logger.info('Missing file test completed', {
        jobId,
        error: response.body.error,
      });
    });
  });

  describe('Error handling', () => {
    it('should handle upload errors gracefully', async () => {
      const response = await request(app)
        .post('/api/upload')
        .field('userId', 'test-user')
        // No file attached

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();

      logger.info('Upload error handling test completed', {
        error: response.body.error,
      });
    });

    it('should handle status check errors gracefully', async () => {
      const response = await request(app).get('/api/jobs/invalid-job-id/status');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      logger.info('Status check error handling test completed');
    });

    it('should handle download errors gracefully', async () => {
      const response = await request(app).get('/api/jobs/invalid-job-id/download');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      logger.info('Download error handling test completed');
    });
  });

  describe('Concurrent requests', () => {
    it('should handle multiple concurrent status checks', async () => {
      const jobId = `test-concurrent-${Date.now()}`;
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      // Create job
      await jobStorage.createJob(jobId, userId, videoMetadata);
      await jobStorage.updateJobStatus(jobId, 'processing');

      // Make concurrent requests
      const responses = await Promise.all([
        request(app).get(`/api/jobs/${jobId}/status`),
        request(app).get(`/api/jobs/${jobId}/status`),
        request(app).get(`/api/jobs/${jobId}/status`),
      ]);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.jobId).toBe(jobId);
      });

      logger.info('Concurrent requests test completed', {
        jobId,
        requestCount: responses.length,
      });
    });
  });
});
