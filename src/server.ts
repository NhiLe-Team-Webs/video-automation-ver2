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
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Increase timeout for long-running requests (30 minutes)
    app.use((req, res, next) => {
      req.setTimeout(30 * 60 * 1000);
      res.setTimeout(30 * 60 * 1000);
      next();
    });

    // Health check endpoint (before other routes)
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // API Routes - Define specific routes BEFORE static file serving
    // IMPORTANT: More specific routes must come BEFORE general routes
    app.use('/api/preview', previewRouter);
    app.use('/api', uploadRouter);

    // Upload interface (main UI)
    app.get('/', (_req, res) => {
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Automation - Upload</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 10px; font-size: 32px; }
    .subtitle { color: #666; margin-bottom: 30px; font-size: 16px; }
    .links { display: flex; flex-direction: column; gap: 15px; }
    .link-btn {
      display: block;
      padding: 15px 30px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-size: 16px;
      transition: all 0.3s;
    }
    .link-btn:hover { background: #5568d3; transform: translateY(-2px); }
    .link-btn.secondary { background: #764ba2; }
    .link-btn.secondary:hover { background: #653a8a; }
    .status { margin-top: 30px; padding: 15px; background: #f0f0f0; border-radius: 8px; }
    .status-item { display: flex; justify-content: space-between; padding: 8px 0; }
    .status-label { color: #666; }
    .status-value { color: #333; font-weight: 600; }
    .status-ok { color: #4CAF50; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 Video Automation</h1>
    <p class="subtitle">Automated video editing and processing</p>
    
    <div class="links">
      <a href="/upload" class="link-btn">📤 Upload Video</a>
      <a href="/preview" class="link-btn secondary">🎨 Preview Templates</a>
      <a href="/api/preview/list" class="link-btn secondary">📋 View Previews</a>
    </div>

    <div class="status">
      <div class="status-item">
        <span class="status-label">Server Status:</span>
        <span class="status-value status-ok">✓ Running</span>
      </div>
      <div class="status-item">
        <span class="status-label">API Endpoint:</span>
        <span class="status-value">/api/upload</span>
      </div>
      <div class="status-item">
        <span class="status-label">Preview Port:</span>
        <span class="status-value">3001</span>
      </div>
    </div>
  </div>
</body>
</html>
      `);
    });

    // Preview interface - redirect to Remotion Studio
    app.get('/preview', (_req, res) => {
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview - Remotion Studio</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      overflow: hidden;
    }
    #remotion-frame {
      width: 100vw;
      height: 100vh;
      border: none;
    }
    .loading {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 1000;
    }
    .spinner {
      border: 4px solid #333;
      border-top: 4px solid #4CAF50;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #2a2a2a;
      padding: 40px;
      border-radius: 8px;
      text-align: center;
      max-width: 500px;
      z-index: 1001;
    }
    .error h2 { color: #f44336; margin-bottom: 15px; }
    .error p { color: #ccc; margin-bottom: 20px; line-height: 1.6; }
    .error button {
      padding: 12px 24px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    .error button:hover { background: #45a049; }
    .error code {
      display: block;
      background: #1a1a1a;
      padding: 10px;
      border-radius: 4px;
      margin: 15px 0;
      color: #4CAF50;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="loading" id="loading">
    <div class="spinner"></div>
    <p>Loading Remotion Studio...</p>
  </div>

  <div class="error" id="error">
    <h2>⚠️ Remotion Studio Not Running</h2>
    <p>Remotion Studio needs to be running to preview animations.</p>
    <p><strong>Start Remotion Studio:</strong></p>
    <code>npm run preview</code>
    <p style="margin-top: 15px; font-size: 14px;">Or in a new terminal:</p>
    <code>npx remotion studio src/remotion/index.ts --port 3001</code>
    <button onclick="location.reload()">Retry</button>
  </div>

  <iframe 
    id="remotion-frame" 
    src="http://localhost:3001"
    title="Remotion Studio"
  ></iframe>

  <script>
    const frame = document.getElementById('remotion-frame');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    let checkAttempts = 0;
    const maxAttempts = 3;

    // Check if Remotion Studio is running
    async function checkRemotionStudio() {
      try {
        const response = await fetch('http://localhost:3001', { mode: 'no-cors' });
        // If we get here, Remotion Studio is running
        hideLoading();
      } catch (err) {
        checkAttempts++;
        if (checkAttempts >= maxAttempts) {
          showError();
        } else {
          setTimeout(checkRemotionStudio, 1000);
        }
      }
    }

    function hideLoading() {
      loading.style.display = 'none';
    }

    function showError() {
      loading.style.display = 'none';
      error.style.display = 'block';
      frame.style.display = 'none';
    }

    // Start checking
    checkRemotionStudio();

    // Hide loading when iframe loads
    frame.onload = () => {
      hideLoading();
    };

    // Handle iframe errors
    frame.onerror = () => {
      showError();
    };
  </script>
</body>
</html>
      `);
    });

    // Upload page
    app.get('/upload', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'src', 'public', 'upload.html'));
    });

    // Test interface
    app.get('/test-preview', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'test-preview-interface.html'));
    });

    // Serve static files for preview interface (after specific routes)
    app.use('/static', express.static(path.join(process.cwd(), 'src', 'public')));
    app.use('/previews', express.static(path.join(process.cwd(), 'temp', 'previews')));

    // Error handlers (must be last)
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