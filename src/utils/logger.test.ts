import { describe, it, expect, beforeEach } from 'vitest';

describe('Logger', () => {
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

  it('should create a logger with context', async () => {
    const { createLogger } = await import('./logger');
    const logger = createLogger('TestContext');
    expect(logger).toBeDefined();
  });

  it('should have all log level methods', async () => {
    const { createLogger } = await import('./logger');
    const logger = createLogger('TestContext');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should log messages without throwing errors', async () => {
    const { createLogger } = await import('./logger');
    const logger = createLogger('TestContext');
    
    expect(() => logger.info('Test info message')).not.toThrow();
    expect(() => logger.error('Test error message', { jobId: 'test-123' })).not.toThrow();
    expect(() => logger.warn('Test warning')).not.toThrow();
    expect(() => logger.debug('Test debug')).not.toThrow();
  });
});
