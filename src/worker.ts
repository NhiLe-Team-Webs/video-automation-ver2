import { config } from './config';
import { createLogger } from './utils/logger';

const logger = createLogger('Worker');

async function startWorker() {
  try {
    logger.info('Starting worker node', {
      redisHost: config.redis.host,
      redisPort: config.redis.port,
    });

    // Worker initialization will be implemented in later tasks
    logger.info('Worker node started successfully');
  } catch (error) {
    logger.error('Failed to start worker node', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

startWorker();
