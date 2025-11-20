import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  ProcessingError,
  ExternalAPIError,
  StorageError,
  ErrorHandler,
  ErrorContext,
} from './errors';

describe('Error Classes', () => {
  it('should create AppError with correct properties', () => {
    const error = new AppError('Test error', 500, true);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
  });

  it('should create ValidationError with 400 status code', () => {
    const error = new ValidationError('Invalid input');
    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
  });

  it('should create ProcessingError with 500 status code', () => {
    const error = new ProcessingError('Processing failed');
    expect(error.message).toBe('Processing failed');
    expect(error.statusCode).toBe(500);
  });

  it('should create ExternalAPIError with 502 status code', () => {
    const error = new ExternalAPIError('API call failed');
    expect(error.message).toBe('API call failed');
    expect(error.statusCode).toBe(502);
  });

  it('should create StorageError with 500 status code', () => {
    const error = new StorageError('Storage failed');
    expect(error.message).toBe('Storage failed');
    expect(error.statusCode).toBe(500);
  });
});

describe('ErrorHandler', () => {
  const handler = new ErrorHandler();
  const context: ErrorContext = {
    jobId: 'test-job-123',
    stage: 'transcribing',
    attemptNumber: 1,
  };

  it('should handle ValidationError with fail action', async () => {
    const error = new ValidationError('Invalid video format');
    const resolution = await handler.handleError(error, context);
    
    expect(resolution.action).toBe('fail');
    expect(resolution.userMessage).toBe('Invalid video format');
  });

  it('should handle ProcessingError with fail action', async () => {
    const error = new ProcessingError('Auto editor failed');
    const resolution = await handler.handleError(error, context);
    
    expect(resolution.action).toBe('fail');
    expect(resolution.userMessage).toContain('Processing failed');
    expect(resolution.userMessage).toContain('transcribing');
  });

  it('should handle ExternalAPIError with retry on first attempt', async () => {
    const error = new ExternalAPIError('Whisper API timeout');
    const resolution = await handler.handleError(error, { ...context, attemptNumber: 1 });
    
    expect(resolution.action).toBe('retry');
    expect(resolution.delay).toBe(2000); // 2^1 * 1000
  });

  it('should handle ExternalAPIError with fail after 3 attempts', async () => {
    const error = new ExternalAPIError('Whisper API timeout');
    const resolution = await handler.handleError(error, { ...context, attemptNumber: 3 });
    
    expect(resolution.action).toBe('fail');
    expect(resolution.userMessage).toContain('failed after 3 attempts');
  });

  it('should handle StorageError with retry and exponential backoff', async () => {
    const error = new StorageError('Google Sheets API error');
    const resolution1 = await handler.handleError(error, { ...context, attemptNumber: 1 });
    const resolution2 = await handler.handleError(error, { ...context, attemptNumber: 2 });
    
    expect(resolution1.action).toBe('retry');
    expect(resolution1.delay).toBe(2000); // 2^1 * 1000
    
    expect(resolution2.action).toBe('retry');
    expect(resolution2.delay).toBe(4000); // 2^2 * 1000
  });

  it('should handle unknown errors with fail action', async () => {
    const error = new Error('Unknown error');
    const resolution = await handler.handleError(error, context);
    
    expect(resolution.action).toBe('fail');
    expect(resolution.userMessage).toContain('Unexpected error');
  });
});
