import { Queue, Worker, Job as BullJob, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';
import { Job } from '../../models/job';

const logger = createLogger('Queue');

// Redis connection
const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

// Job queue for video processing
export const videoQueue = new Queue('video-processing', {
  connection,
  defaultJobOptions: {
    attempts: 1, // Pipeline handles retries internally
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 100, // Keep last 100 failed jobs
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
});

// Queue events for monitoring
export const queueEvents = new QueueEvents('video-processing', {
  connection,
});

// Set up queue event listeners
queueEvents.on('added', ({ jobId }) => {
  logger.info('Queue event: Job added', { jobId });
});

queueEvents.on('active', ({ jobId }) => {
  logger.info('Queue event: Job active', { jobId });
});

queueEvents.on('completed', ({ jobId }) => {
  logger.info('Queue event: Job completed', { jobId });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Queue event: Job failed', { jobId, failedReason });
});

queueEvents.on('error', (error) => {
  logger.error('Queue event error', { error: error.message });
});

export interface VideoProcessingJobData {
  jobId: string;
  userId: string;
  videoPath: string;
}

/**
 * Add a video processing job to the queue
 */
export async function addVideoJob(data: VideoProcessingJobData): Promise<string> {
  try {
    logger.info('Adding video job to queue', {
      jobId: data.jobId,
      userId: data.userId,
      videoPath: data.videoPath,
    });

    const job = await videoQueue.add('process-video', data, {
      jobId: data.jobId,
    });

    logger.info('Video job added to queue successfully', {
      jobId: data.jobId,
      userId: data.userId,
      bullJobId: job.id,
      queueName: 'video-processing',
      jobName: 'process-video',
    });

    return job.id!;
  } catch (error) {
    logger.error('Failed to add video job to queue', {
      jobId: data.jobId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Get job status from queue
 */
export async function getQueueJobStatus(jobId: string): Promise<{
  state: string;
  progress: number;
  data?: any;
}> {
  try {
    const job = await videoQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue`);
    }

    const state = await job.getState();
    const progress = job.progress as number || 0;

    return {
      state,
      progress,
      data: job.data,
    };
  } catch (error) {
    logger.error('Failed to get job status from queue', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Clean up queue resources
 */
export async function closeQueue(): Promise<void> {
  await videoQueue.close();
  await queueEvents.close();
  await connection.quit();
  logger.info('Queue connections closed');
}
