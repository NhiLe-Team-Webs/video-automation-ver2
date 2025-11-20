import { config } from './config';
import { createLogger } from './utils/logger';

const logger = createLogger('Server');

async function startServer() {
  try {
    logger.info('Starting API server', {
      port: config.server.port,
      env: config.server.env,
    });

    // Server initialization will be implemented in later tasks
    logger.info('API server started successfully', {
      port: config.server.port,
    });
  } catch (error) {
    logger.error('Failed to start API server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

startServer();
