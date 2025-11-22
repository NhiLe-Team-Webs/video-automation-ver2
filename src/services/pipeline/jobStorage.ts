import { Job, VideoMetadata } from '../../models/job';
import { PipelineStage } from '../../utils/errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('JobStorage');

// In-memory job storage (simple Map for single-user MVP)
// For production with multiple users, consider using a database
const jobStore = new Map<string, Job>();



/**
 * Create a new job
 */
export async function createJob(
  id: string,
  userId: string,
  videoMetadata: VideoMetadata
): Promise<Job> {
  const job: Job = {
    id,
    userId,
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    videoMetadata,
    processingStages: [],
  };

  jobStore.set(id, job);
  
  logger.info('Job created', {
    jobId: id,
    userId,
  });

  return job;
}

/**
 * Get a job by ID
 */
export async function getJob(jobId: string): Promise<Job | undefined> {
  return jobStore.get(jobId);
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: 'queued' | 'processing' | 'completed' | 'failed'
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  job.status = status;
  job.updatedAt = new Date();
  
  jobStore.set(jobId, job);
  
  logger.info('Job status updated', {
    jobId,
    status,
  });
}

/**
 * Add or update a processing stage
 */
export async function updateStage(
  jobId: string,
  stage: PipelineStage,
  status: 'pending' | 'in-progress' | 'completed' | 'failed',
  outputPath?: string,
  error?: string
): Promise<void> {
  const job = await getJob(jobId);
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

  jobStore.set(jobId, job);

  logger.info('Stage updated', {
    jobId,
    stage,
    status,
  });
}

/**
 * Set job error
 */
export async function setJobError(
  jobId: string,
  stage: PipelineStage,
  message: string,
  stack?: string
): Promise<void> {
  const job = await getJob(jobId);
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

  jobStore.set(jobId, job);

  logger.error('Job error set', {
    jobId,
    stage,
    message,
  });
}

/**
 * Set final video URL (from Wasabi storage)
 */
export async function setVideoUrl(jobId: string, url: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  job.finalYoutubeUrl = url; // Now stores Wasabi URL instead of YouTube
  job.updatedAt = new Date();

  jobStore.set(jobId, job);

  logger.info('Video URL set', {
    jobId,
    url,
  });
}

/**
 * Get all jobs (for debugging/monitoring)
 */
export async function getAllJobs(): Promise<Job[]> {
  return Array.from(jobStore.values());
}

/**
 * Get jobs by user ID
 */
export async function getJobsByUser(userId: string): Promise<Job[]> {
  const allJobs = await getAllJobs();
  return allJobs.filter(job => job.userId === userId);
}
