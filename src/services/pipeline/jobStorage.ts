import { Job, VideoMetadata } from '../../models/job';
import { PipelineStage } from '../../utils/errors';
import { createLogger } from '../../utils/logger';
import IORedis from 'ioredis';
import { config } from '../../config';

const logger = createLogger('JobStorage');

// Redis connection for persistent job storage
const redis = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

const JOB_KEY_PREFIX = 'job:';

/**
 * Serialize job to JSON for storage
 */
function serializeJob(job: Job): string {
  return JSON.stringify(job);
}

/**
 * Deserialize job from JSON
 */
function deserializeJob(data: string): Job {
  const parsed = JSON.parse(data);
  // Convert date strings back to Date objects
  parsed.createdAt = new Date(parsed.createdAt);
  parsed.updatedAt = new Date(parsed.updatedAt);
  if (parsed.error?.timestamp) {
    parsed.error.timestamp = new Date(parsed.error.timestamp);
  }
  parsed.processingStages = parsed.processingStages.map((stage: any) => ({
    ...stage,
    startTime: stage.startTime ? new Date(stage.startTime) : undefined,
    endTime: stage.endTime ? new Date(stage.endTime) : undefined,
  }));
  return parsed;
}

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

  await redis.set(JOB_KEY_PREFIX + id, serializeJob(job));
  
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
  const data = await redis.get(JOB_KEY_PREFIX + jobId);
  if (!data) {
    return undefined;
  }
  return deserializeJob(data);
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
  
  await redis.set(JOB_KEY_PREFIX + jobId, serializeJob(job));
  
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

  await redis.set(JOB_KEY_PREFIX + jobId, serializeJob(job));

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

  await redis.set(JOB_KEY_PREFIX + jobId, serializeJob(job));

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

  job.finalYoutubeUrl = url; // Keep same field name for backward compatibility
  job.updatedAt = new Date();

  await redis.set(JOB_KEY_PREFIX + jobId, serializeJob(job));

  logger.info('Video URL set', {
    jobId,
    url,
  });
}

/**
 * Get all jobs (for debugging/monitoring)
 */
export async function getAllJobs(): Promise<Job[]> {
  const keys = await redis.keys(JOB_KEY_PREFIX + '*');
  const jobs: Job[] = [];
  
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      jobs.push(deserializeJob(data));
    }
  }
  
  return jobs;
}

/**
 * Get jobs by user ID
 */
export async function getJobsByUser(userId: string): Promise<Job[]> {
  const allJobs = await getAllJobs();
  return allJobs.filter(job => job.userId === userId);
}
