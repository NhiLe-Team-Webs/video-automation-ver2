import express from 'express';
import path from 'path';
import { config } from './config';
import { createLogger } from './utils/logger';
import { uploadRouter, errorHandler } from './api/uploadRoutes';
import { previewRouter, previewErrorHandler } from './api/previewRoutes';

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

    // Routes - Define specific routes BEFORE static file serving
    app.use('/api', uploadRouter);
    app.use('/api/preview', previewRouter);

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // Preview interface
    app.get('/preview', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'src', 'public', 'preview.html'));
    });

    // Test interface
    app.get('/test-preview', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'test-preview-interface.html'));
    });

    // Serve static files for preview interface (after specific routes)
    app.use('/static', express.static(path.join(process.cwd(), 'src', 'public')));
    app.use('/previews', express.static(path.join(process.cwd(), 'temp', 'previews')));

    // Error handling
    app.use(previewErrorHandler);
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
