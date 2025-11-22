import express from 'express';
import path from 'path';
import { config } from './config';
import { createLogger } from './utils/logger';
import { uploadRouter, errorHandler } from './api/uploadRoutes';
import { previewRouter, previewErrorHandler } from './api/previewRoutes';
import oauthRouter from './api/oauthRoutes';

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
    // IMPORTANT: More specific routes must come BEFORE general routes
    app.use('/oauth', oauthRouter);
    app.use('/api/preview', previewRouter, previewErrorHandler);
    app.use('/api', uploadRouter, errorHandler);

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // Upload interface (main UI)
    app.get('/', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'src', 'public', 'upload.html'));
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
