import { Job, StageResult, ErrorInfo, VideoMetadata } from '../models/job';
import { PipelineStage } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('JobStorage');

// In-memory storage for jobs (will be replaced with database in production)
const jobs = new Map<string, Job>();

/**
 * Create a new job
 */
export function createJob(
  id: string,
  userId: string,
  videoMetadata: VideoMetadata
): Job {
  const job: Job = {
    id,
    userId,
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    videoMetadata,
    processingStages: [],
  };

  jobs.set(id, job);
  
  logger.info('Job created', {
    jobId: id,
    userId,
  });

  return job;
}

/**
 * Get a job by ID
 */
export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

/**
 * Update job status
 */
export function updateJobStatus(
  jobId: string,
  status: 'queued' | 'processing' | 'completed' | 'failed'
): void {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  job.status = status;
  job.updatedAt = new Date();
  
  logger.info('Job status updated', {
    jobId,
    status,
  });
}

/**
 * Add or update a processing stage
 */
export function updateStage(
  jobId: string,
  stage: PipelineStage,
  status: 'pending' | 'in-progress' | 'completed' | 'failed',
  outputPath?: string,
  error?: string
): void {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  // Find existing stage or create new one
  let stageResult = job.processingStages.find(s => s.stage === stage);
  
  if (!stageResult) {
    stageResult = {
      stage,
      status: 'pending',
      startTime: new Date(),
    };
    job.processingStages.push(stageResult);
  }

  // Update stage
  stageResult.status = status;
  if (status === 'in-progress' && !stageResult.startTime) {
    stageResult.startTime = new Date();
  }
  if (status === 'completed' || status === 'failed') {
    stageResult.endTime = new Date();
  }
  if (outputPath) {
    stageResult.outputPath = outputPath;
  }
  if (error) {
    stageResult.error = error;
  }

  job.updatedAt = new Date();

  logger.info('Stage updated', {
    jobId,
    stage,
    status,
  });
}

/**
 * Set job error
 */
export function setJobError(
  jobId: string,
  stage: PipelineStage,
  message: string,
  stack?: string
): void {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  job.error = {
    stage,
    message,
    stack,
    timestamp: new Date(),
  };
  job.status = 'failed';
  job.updatedAt = new Date();

  logger.error('Job error set', {
    jobId,
    stage,
    message,
  });
}

/**
 * Set final YouTube URL
 */
export function setYoutubeUrl(jobId: string, url: string): void {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  job.finalYoutubeUrl = url;
  job.updatedAt = new Date();

  logger.info('YouTube URL set', {
    jobId,
    url,
  });
}

/**
 * Get all jobs (for debugging/monitoring)
 */
export function getAllJobs(): Job[] {
  return Array.from(jobs.values());
}

/**
 * Get jobs by user ID
 */
export function getJobsByUser(userId: string): Job[] {
  return Array.from(jobs.values()).filter(job => job.userId === userId);
}
