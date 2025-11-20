import express from 'express';
import { config } from './config';
import { createLogger } from './utils/logger';
import { uploadRouter, errorHandler } from './api/uploadRoutes';

const logger = createLogger('Server');

async function startServer() {
  try {
    logger.info('Starting API server', {
      port: config.server.port,
      env: config.server.env,
    });

    const app = express();

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Routes
    app.use('/api', uploadRouter);

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // Error handling
    app.use(errorHandler);

    // Start server
    app.listen(config.server.port, () => {
      logger.info('API server started successfully', {
        port: config.server.port,
      });
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
