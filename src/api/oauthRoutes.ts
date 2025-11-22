/**
 * OAuth Routes
 * Handles YouTube OAuth callback
 */

import { Router, Request, Response } from 'express';
import { YouTubeUploadService } from '../services/youtube/youtubeUploadService';
import { createLogger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const logger = createLogger('OAuthRoutes');

/**
 * GET /oauth/callback
 * YouTube OAuth callback endpoint
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query;

    // Handle authorization error
    if (error) {
      logger.error('OAuth authorization error', { error });
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authorization Failed</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
            h1 { color: #c00; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Authorization Failed</h1>
            <p><strong>Error:</strong> ${error}</p>
            <p>Please try again or check your Google Cloud Console settings.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Check if code is provided
    if (!code || typeof code !== 'string') {
      logger.error('No authorization code provided');
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Missing Code</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
            h1 { color: #c00; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Missing Authorization Code</h1>
            <p>No authorization code was provided in the callback.</p>
          </div>
        </body>
        </html>
      `);
    }

    logger.info('Received OAuth callback', { code: code.substring(0, 20) + '...' });

    // Exchange code for tokens
    const youtubeService = new YouTubeUploadService();
    const tokens = await youtubeService.getTokensFromCode(code);

    logger.info('Tokens obtained successfully', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    });

    // Save tokens to file
    const tokensFile = path.join(process.cwd(), 'youtube-tokens.json');
    await fs.writeFile(tokensFile, JSON.stringify(tokens, null, 2));

    logger.info('Tokens saved to file', { tokensFile });

    // Return success page with instructions
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Successful</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 50px auto; 
            padding: 20px; 
            background: #f5f5f5;
          }
          .success { 
            background: #efe; 
            border: 1px solid #cfc; 
            padding: 30px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #060; margin-top: 0; }
          .token-info { 
            background: #fff; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
          }
          .instructions { 
            background: #fff3cd; 
            border: 1px solid #ffc107; 
            padding: 20px; 
            border-radius: 5px; 
            margin-top: 20px;
          }
          .instructions h2 { margin-top: 0; color: #856404; }
          .instructions ol { padding-left: 20px; }
          .instructions li { margin: 10px 0; }
          code { 
            background: #f4f4f4; 
            padding: 2px 6px; 
            border-radius: 3px;
            font-family: monospace;
          }
          .env-vars {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            font-family: monospace;
            font-size: 13px;
            overflow-x: auto;
          }
          .copy-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
          }
          .copy-btn:hover {
            background: #0056b3;
          }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Authorization Successful!</h1>
          <p>Your YouTube OAuth tokens have been obtained and saved.</p>
          
          <div class="token-info">
            <strong>Token Details:</strong><br>
            Access Token: ${tokens.access_token?.substring(0, 30)}...<br>
            Refresh Token: ${tokens.refresh_token ? tokens.refresh_token.substring(0, 30) + '...' : 'Not provided'}<br>
            Expires: ${tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : 'Unknown'}
          </div>

          <div class="instructions">
            <h2>📋 Next Steps:</h2>
            <ol>
              <li>
                <strong>Add tokens to your .env file:</strong>
                <div class="env-vars" id="envVars">YOUTUBE_ACCESS_TOKEN=${tokens.access_token}
${tokens.refresh_token ? `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}` : '# No refresh token provided'}</div>
                <button class="copy-btn" onclick="copyToClipboard()">📋 Copy to Clipboard</button>
              </li>
              <li>
                <strong>Restart your application</strong> to load the new credentials
              </li>
              <li>
                <strong>Test the upload:</strong>
                <code>npx tsx test-rendering-and-upload.ts</code>
              </li>
            </ol>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            ℹ️ Tokens have been saved to: <code>youtube-tokens.json</code><br>
            You can now close this window.
          </p>
        </div>

        <script>
          function copyToClipboard() {
            const text = document.getElementById('envVars').textContent;
            navigator.clipboard.writeText(text).then(() => {
              const btn = document.querySelector('.copy-btn');
              btn.textContent = '✅ Copied!';
              setTimeout(() => {
                btn.textContent = '📋 Copy to Clipboard';
              }, 2000);
            });
          }
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    logger.error('OAuth callback error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
          h1 { color: #c00; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 3px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Error Processing OAuth Callback</h1>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
          <pre>${error instanceof Error ? error.stack : ''}</pre>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * GET /oauth/start
 * Start OAuth flow - redirects to Google authorization
 */
router.get('/oauth/start', (req: Request, res: Response) => {
  try {
    const youtubeService = new YouTubeUploadService();
    const authUrl = youtubeService.getAuthUrl();

    logger.info('Starting OAuth flow', { authUrl });

    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error starting OAuth flow', {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
          h1 { color: #c00; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Error Starting OAuth Flow</h1>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
        </div>
      </body>
      </html>
    `);
  }
});

export default router;
