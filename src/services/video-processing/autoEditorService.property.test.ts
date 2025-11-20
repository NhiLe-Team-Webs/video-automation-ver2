import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { AutoEditorService } from '../video-processing/autoEditorService';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

// Mock dependencies
vi.mock('child_process');
vi.mock('fluent-ffmpeg');
vi.mock('../../config', () => ({
  config: {
    autoEditor: {
      margin: '0.2sec',
      threshold: 0.04,
    },
    server: {
      env: 'test',
      port: 3000,
    },
  },
}));

/**
 * Feature: youtube-video-automation, Property 5: Auto Editor output is shorter
 * 
 * Property: For any video processed by Auto Editor, the duration of the output video 
 * should be less than or equal to the duration of the input video.
 * 
 * Validates: Requirements 2.2
 */
describe('AutoEditorService - Property-Based Tests', () => {
  let service: AutoEditorService;
  let mockProcess: any;

  beforeEach(() => {
    service = new AutoEditorService();
    
    // Setup mock process
    mockProcess = {
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Feature: youtube-video-automation, Property 5: Auto Editor output is shorter
   */
  it('Property 5: output duration should be less than or equal to input duration for any video', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary video metadata
        fc.record({
          inputDuration: fc.double({ min: 1, max: 3600, noNaN: true }), // 1 second to 1 hour
          width: fc.integer({ min: 320, max: 3840 }), // Common video widths
          height: fc.integer({ min: 240, max: 2160 }), // Common video heights
          reductionFactor: fc.double({ min: 0, max: 1, noNaN: true }), // 0% to 100% reduction
        }),
        async ({ inputDuration, width, height, reductionFactor }) => {
          // Calculate output duration (should be <= input duration)
          const outputDuration = inputDuration * (1 - reductionFactor);
          
          const inputPath = `/temp/test-video-${Date.now()}.mp4`;

          // Mock ffprobe to return generated metadata
          let callCount = 0;
          const mockFfprobe = vi.fn((filePath: string, callback: Function) => {
            callCount++;
            const metadata = {
              streams: [
                {
                  codec_type: 'video',
                  width,
                  height,
                },
              ],
              format: {
                // First call returns input duration, second call returns output duration
                duration: callCount === 1 ? inputDuration : outputDuration,
              },
            };
            callback(null, metadata);
          });
          vi.mocked(ffmpeg.ffprobe).mockImplementation(mockFfprobe as any);

          // Mock spawn to simulate successful Auto Editor execution
          mockProcess.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
            return mockProcess;
          });

          // Process the video
          const result = await service.processVideo(inputPath);

          // Property: output duration should be <= input duration
          expect(result.outputDuration).toBeLessThanOrEqual(result.inputDuration);
          
          // Additional verification: the values should match what we generated
          expect(result.inputDuration).toBe(inputDuration);
          expect(result.outputDuration).toBe(outputDuration);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in the design document
    );
  });
});
