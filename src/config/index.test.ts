import { describe, it, expect, beforeEach } from 'vitest';

describe('Configuration', () => {
  beforeEach(() => {
    // Set minimal required environment variables for testing
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.WHISPER_MODEL = 'base';
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'test-sheet-id';
    process.env.GOOGLE_SHEETS_CREDENTIALS = 'test-credentials.json';
    process.env.PEXELS_API_KEY = 'test-pexels-key';
    process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
    process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
    process.env.YOUTUBE_REDIRECT_URI = 'http://localhost:3000/oauth/callback';
    // Notification endpoint is optional
    process.env.NOTIFICATION_ENDPOINT = 'http://test-webhook.com';
  });

  it('should load configuration from environment variables', async () => {
    // Dynamic import to ensure env vars are set before config is loaded
    const { config } = await import('./index');
    
    expect(config.gemini.apiKey).toBe('test-gemini-key');
    expect(config.googleSheets.spreadsheetId).toBe('test-sheet-id');
    expect(config.pexels.apiKey).toBe('test-pexels-key');
    expect(config.youtube.clientId).toBe('test-client-id');
  });

  it('should use default values for optional configuration', async () => {
    const { config } = await import('./index');
    
    expect(config.autoEditor.margin).toBe('0.2sec');
    expect(config.autoEditor.threshold).toBe(0.04);
    expect(config.whisper.model).toBe('base');
    expect(config.whisper.useLocal).toBe(true);
    // Note: GEMINI_MODEL is set in .env file to 'gemini-2.5-flash'
    expect(config.gemini.model).toBe('gemini-2.5-flash');
  });

  it('should configure redis connection', async () => {
    const { config } = await import('./index');
    
    expect(config.redis.host).toBe('localhost');
    expect(config.redis.port).toBe(6379);
  });

  it('should configure server settings', async () => {
    const { config } = await import('./index');
    
    expect(config.server.port).toBe(3000);
    expect(config.server.env).toBeDefined();
  });
});
