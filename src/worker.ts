import { Worker, Job as BullJob } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';
import { createLogger } from './utils/logger';
import { VideoProcessingJobData } from './services/queue';
import { processVideo } from './services/pipelineOrchestrator';

const logger = createLogger('Worker');

// Redis connection
const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

let worker: Worker | null = null;

async function startWorker() {
  try {
    logger.info('Starting worker node', {
      redisHost: config.redis.host,
      redisPort: config.redis.port,
    });

    // Create worker to process video jobs
    worker = new Worker<VideoProcessingJobData>(
      'video-processing',
      async (job: BullJob<VideoProcessingJobData>) => {
        logger.info('Processing video job', {
          jobId: job.data.jobId,
          userId: job.data.userId,
          bullJobId: job.id,
        });

        try {
          // Update progress to indicate processing started
          await job.updateProgress(0);

          // Process the video through the pipeline
          const result = await processVideo(job.data.jobId);

          // Update progress to 100% on completion
          await job.updateProgress(100);

          logger.info('Video job completed', {
            jobId: job.data.jobId,
            status: result.status,
          });

          return result;
        } catch (error) {
          logger.error('Video job failed', {
            jobId: job.data.jobId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
      },
      {
        connection,
        concurrency: 5, // Process up to 5 jobs concurrently
      }
    );

    // Worker event handlers
    worker.on('completed', (job) => {
      logger.info('Job completed', {
        jobId: job.id,
        data: job.data,
      });
    });

    worker.on('failed', (job, err) => {
      logger.error('Job failed', {
        jobId: job?.id,
        error: err.message,
        stack: err.stack,
      });
    });

    worker.on('error', (err) => {
      logger.error('Worker error', {
        error: err.message,
        stack: err.stack,
      });
    });

    logger.info('Worker node started successfully');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await shutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await shutdown();
    });
  } catch (error) {
    logger.error('Failed to start worker node', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

async function shutdown() {
  try {
    if (worker) {
      await worker.close();
      logger.info('Worker closed');
    }
    await connection.quit();
    logger.info('Redis connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

startWorker();
