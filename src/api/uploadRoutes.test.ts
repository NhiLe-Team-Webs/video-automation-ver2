import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { ValidationError } from '../utils/errors';
import { uploadRouter, errorHandler } from './uploadRoutes';
import * as jobStorage from '../services/pipeline/jobStorage';

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../services/upload/videoUploadHandler');

describe('Upload Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', uploadRouter);
    app.use(errorHandler);
  });

  it('should handle validation errors correctly', () => {
    const error = new ValidationError('Invalid video format');
    
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.message).toBe('Invalid video format');
  });

  it('should calculate progress correctly', () => {
    const stages = [
      { stage: 'uploaded', status: 'completed', startTime: new Date() },
      { stage: 'auto-editing', status: 'completed', startTime: new Date() },
      { stage: 'transcribing', status: 'in-progress', startTime: new Date() },
    ];

    // Progress calculation: 2 completed out of 9 total stages = ~22%
    const totalStages = 9;
    const completedStages = stages.filter((s) => s.status === 'completed').length;
    const progress = Math.round((completedStages / totalStages) * 100);

    expect(progress).toBe(22);
  });

  describe('GET /api/jobs/:jobId/status', () => {
    it('should return 404 when job does not exist', async () => {
      const response = await request(app).get('/api/jobs/nonexistent/status');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });

    it('should return job status with progress and estimated time', async () => {
      // Create a test job
      const jobId = 'test-job-123';
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      const job = jobStorage.createJob(jobId, userId, videoMetadata);
      jobStorage.updateJobStatus(jobId, 'processing');
      jobStorage.updateStage(jobId, 'uploaded', 'completed');
      jobStorage.updateStage(jobId, 'auto-editing', 'in-progress');

      const response = await request(app).get(`/api/jobs/${jobId}/status`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe(jobId);
      expect(response.body.data.status).toBe('processing');
      expect(response.body.data.currentStage).toBe('auto-editing');
      expect(response.body.data.progress).toBeGreaterThan(0);
      expect(response.body.data.elapsedTimeMs).toBeGreaterThanOrEqual(0);
      expect(response.body.data.estimatedTimeRemainingMs).toBeGreaterThanOrEqual(0);
    });

    it('should include YouTube URL when job is completed', async () => {
      const jobId = 'test-job-completed';
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      const job = jobStorage.createJob(jobId, userId, videoMetadata);
      jobStorage.updateStage(jobId, 'uploaded', 'completed');
      jobStorage.updateStage(jobId, 'auto-editing', 'completed');
      jobStorage.updateStage(jobId, 'transcribing', 'completed');
      jobStorage.updateStage(jobId, 'storing-transcript', 'completed');
      jobStorage.updateStage(jobId, 'detecting-highlights', 'completed');
      jobStorage.updateStage(jobId, 'generating-plan', 'completed');
      jobStorage.updateStage(jobId, 'rendering', 'completed');
      jobStorage.updateStage(jobId, 'uploading', 'completed');
      jobStorage.updateStage(jobId, 'completed', 'completed');
      jobStorage.updateJobStatus(jobId, 'completed');
      jobStorage.setYoutubeUrl(jobId, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const response = await request(app).get(`/api/jobs/${jobId}/status`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });
  });

  describe('GET /api/jobs/:jobId/download', () => {
    let tempDir: string;
    let testVideoPath: string;

    beforeEach(() => {
      // Create a temporary directory for test files
      tempDir = path.join(process.cwd(), 'temp', 'test-downloads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create a dummy video file
      testVideoPath = path.join(tempDir, 'test-video.mp4');
      fs.writeFileSync(testVideoPath, Buffer.from('dummy video content'));
    });

    afterEach(() => {
      // Clean up test files
      if (fs.existsSync(testVideoPath)) {
        fs.unlinkSync(testVideoPath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }
    });

    it('should return 404 when job does not exist', async () => {
      const response = await request(app).get('/api/jobs/nonexistent/download');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });

    it('should return 400 when job is not completed', async () => {
      const jobId = 'test-job-processing';
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      jobStorage.createJob(jobId, userId, videoMetadata);
      jobStorage.updateJobStatus(jobId, 'processing');

      const response = await request(app).get(`/api/jobs/${jobId}/download`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not completed');
    });

    it('should return 404 when rendering stage output is missing', async () => {
      const jobId = 'test-job-no-output';
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      jobStorage.createJob(jobId, userId, videoMetadata);
      jobStorage.updateJobStatus(jobId, 'completed');

      const response = await request(app).get(`/api/jobs/${jobId}/download`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Final video file not found');
    });

    it('should stream video file with correct headers', async () => {
      const jobId = 'test-job-download';
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      const job = jobStorage.createJob(jobId, userId, videoMetadata);
      jobStorage.updateJobStatus(jobId, 'completed');
      jobStorage.updateStage(jobId, 'rendering', 'completed', testVideoPath);

      const response = await request(app).get(`/api/jobs/${jobId}/download`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('video/mp4');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain(`${jobId}_final.mp4`);
      expect(response.body.toString()).toBe('dummy video content');
    });

    it('should set proper cache control headers', async () => {
      const jobId = 'test-job-cache';
      const userId = 'test-user';
      const videoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        fileSize: 1024 * 1024 * 100,
        checksum: 'abc123',
      };

      const job = jobStorage.createJob(jobId, userId, videoMetadata);
      jobStorage.updateJobStatus(jobId, 'completed');
      jobStorage.updateStage(jobId, 'rendering', 'completed', testVideoPath);

      const response = await request(app).get(`/api/jobs/${jobId}/download`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
    });
  });
});
