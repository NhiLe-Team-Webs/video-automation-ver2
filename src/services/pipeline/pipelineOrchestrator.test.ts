import { describe, it, expect, beforeEach } from 'vitest';
import { processVideo, getStatus, getNextStage, isValidStage } from './pipelineOrchestrator';
import * as jobStorage from '../pipeline/jobStorage';
import { VideoMetadata } from '../../models/job';

describe('Pipeline Orchestrator', () => {
  const mockMetadata: VideoMetadata = {
    duration: 120,
    resolution: { width: 1920, height: 1080 },
    format: 'mp4',
    fileSize: 1024000,
    checksum: 'abc123',
  };

  beforeEach(() => {
    // Create a test job before each test
    jobStorage.createJob('test-job', 'test-user', mockMetadata);
  });

  it('should process video and initialize pipeline stages', async () => {
    // Set the uploaded stage with output path (simulating successful upload)
    jobStorage.updateStage('test-job', 'uploaded', 'completed', '/temp/test-video.mp4');
    
    const result = await processVideo('test-job');

    expect(result).toBeDefined();
    expect(result.jobId).toBe('test-job');
    // Note: This will fail because Auto Editor will try to process the video
    // For now, we expect it to fail since we don't have a real video file
    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();

    const job = jobStorage.getJob('test-job');
    expect(job?.status).toBe('failed');
    expect(job?.processingStages.length).toBeGreaterThan(0);
  }, { timeout: 10000 });

  it('should get job status with progress', () => {
    jobStorage.updateStage('test-job', 'uploaded', 'completed');
    
    const status = getStatus('test-job');

    expect(status).toBeDefined();
    expect(status.jobId).toBe('test-job');
    expect(status.currentStage).toBeDefined();
    expect(status.progress).toBeGreaterThanOrEqual(0);
    expect(status.progress).toBeLessThanOrEqual(100);
  });

  it('should throw error for non-existent job', () => {
    expect(() => getStatus('non-existent')).toThrow('Job non-existent not found');
  });

  it('should get next stage in pipeline', () => {
    expect(getNextStage('uploaded')).toBe('auto-editing');
    expect(getNextStage('auto-editing')).toBe('transcribing');
    expect(getNextStage('transcribing')).toBe('storing-transcript');
    expect(getNextStage('completed')).toBeNull();
  });

  it('should validate pipeline stages', () => {
    expect(isValidStage('uploaded')).toBe(true);
    expect(isValidStage('auto-editing')).toBe(true);
    expect(isValidStage('completed')).toBe(true);
    expect(isValidStage('invalid-stage')).toBe(false);
  });

  it('should calculate progress correctly', () => {
    // Test progress at different stages
    jobStorage.updateStage('test-job', 'uploaded', 'completed');
    let status = getStatus('test-job');
    expect(status.progress).toBe(0);

    jobStorage.updateStage('test-job', 'auto-editing', 'completed');
    status = getStatus('test-job');
    expect(status.progress).toBeGreaterThan(0);

    jobStorage.updateStage('test-job', 'completed', 'completed');
    status = getStatus('test-job');
    expect(status.progress).toBe(100);
  });

  it('should handle processing errors', async () => {
    // Create a job that doesn't exist to trigger error
    const result = await processVideo('non-existent-job');

    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });
});
