import { describe, it, expect, beforeEach } from 'vitest';
import * as jobStorage from '../pipeline/jobStorage';
import { VideoMetadata } from '../../models/job';

describe('Job Storage Service', () => {
  const mockMetadata: VideoMetadata = {
    duration: 120,
    resolution: { width: 1920, height: 1080 },
    format: 'mp4',
    fileSize: 1024000,
    checksum: 'abc123',
  };

  it('should create a new job', () => {
    const job = jobStorage.createJob('job-1', 'user-1', mockMetadata);

    expect(job).toBeDefined();
    expect(job.id).toBe('job-1');
    expect(job.userId).toBe('user-1');
    expect(job.status).toBe('queued');
    expect(job.videoMetadata).toEqual(mockMetadata);
  });

  it('should retrieve a job by ID', () => {
    jobStorage.createJob('job-2', 'user-2', mockMetadata);
    
    const job = jobStorage.getJob('job-2');

    expect(job).toBeDefined();
    expect(job?.id).toBe('job-2');
  });

  it('should return undefined for non-existent job', () => {
    const job = jobStorage.getJob('non-existent');

    expect(job).toBeUndefined();
  });

  it('should update job status', () => {
    jobStorage.createJob('job-3', 'user-3', mockMetadata);
    
    jobStorage.updateJobStatus('job-3', 'processing');
    
    const job = jobStorage.getJob('job-3');
    expect(job?.status).toBe('processing');
  });

  it('should update stage status', () => {
    jobStorage.createJob('job-4', 'user-4', mockMetadata);
    
    jobStorage.updateStage('job-4', 'auto-editing', 'in-progress');
    
    const job = jobStorage.getJob('job-4');
    const stage = job?.processingStages.find(s => s.stage === 'auto-editing');
    
    expect(stage).toBeDefined();
    expect(stage?.status).toBe('in-progress');
  });

  it('should set job error', () => {
    jobStorage.createJob('job-5', 'user-5', mockMetadata);
    
    jobStorage.setJobError('job-5', 'transcribing', 'Transcription failed');
    
    const job = jobStorage.getJob('job-5');
    
    expect(job?.status).toBe('failed');
    expect(job?.error).toBeDefined();
    expect(job?.error?.stage).toBe('transcribing');
    expect(job?.error?.message).toBe('Transcription failed');
  });

  it('should set YouTube URL', () => {
    jobStorage.createJob('job-6', 'user-6', mockMetadata);
    
    const youtubeUrl = 'https://www.youtube.com/watch?v=abc123';
    jobStorage.setYoutubeUrl('job-6', youtubeUrl);
    
    const job = jobStorage.getJob('job-6');
    
    expect(job?.finalYoutubeUrl).toBe(youtubeUrl);
  });

  it('should get jobs by user ID', () => {
    jobStorage.createJob('job-7', 'user-7', mockMetadata);
    jobStorage.createJob('job-8', 'user-7', mockMetadata);
    jobStorage.createJob('job-9', 'user-8', mockMetadata);
    
    const userJobs = jobStorage.getJobsByUser('user-7');
    
    expect(userJobs.length).toBeGreaterThanOrEqual(2);
    expect(userJobs.every(job => job.userId === 'user-7')).toBe(true);
  });
});
