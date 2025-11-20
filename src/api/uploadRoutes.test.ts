import { describe, it, expect, vi } from 'vitest';
import { ValidationError } from '../utils/errors';

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Upload Routes', () => {
  it('should handle validation errors correctly', () => {
    const error = new ValidationError('Invalid video format');
    
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.message).toBe('Invalid video format');
  });

  it('should calculate progress correctly', () => {
    const stages = [
      { stage: 'uploaded', status: 'completed', startTime: new Date() },
      { stage: 'auto-editing', status: 'completed', startTime: new Date() },
      { stage: 'transcribing', status: 'in-progress', startTime: new Date() },
    ];

    // Progress calculation: 2 completed out of 9 total stages = ~22%
    const totalStages = 9;
    const completedStages = stages.filter((s) => s.status === 'completed').length;
    const progress = Math.round((completedStages / totalStages) * 100);

    expect(progress).toBe(22);
  });
});
