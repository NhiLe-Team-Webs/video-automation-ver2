import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoEditorService } from './autoEditorService';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { ProcessingError } from '../utils/errors';

// Mock dependencies
vi.mock('child_process');
vi.mock('fluent-ffmpeg');
vi.mock('fs/promises');
vi.mock('../config', () => ({
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

describe('AutoEditorService', () => {
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

  describe('processVideo', () => {
    it('should process video successfully and return metadata', async () => {
      const inputPath = '/temp/test-video.mp4';

      // Mock ffprobe for input video
      const mockFfprobe = vi.fn((filePath, callback) => {
        const metadata = {
          streams: [
            {
              codec_type: 'video',
              width: 1920,
              height: 1080,
            },
          ],
          format: {
            duration: 120,
          },
        };
        callback(null, metadata);
      });
      vi.mocked(ffmpeg.ffprobe).mockImplementation(mockFfprobe as any);

      // Mock spawn to simulate successful Auto Editor execution
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          // Simulate successful completion
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const result = await service.processVideo(inputPath);

      // Check result properties without hardcoding path separators
      expect(result.inputDuration).toBe(120);
      expect(result.outputDuration).toBe(120);
      expect(result.inputResolution).toEqual({ width: 1920, height: 1080 });
      expect(result.outputResolution).toEqual({ width: 1920, height: 1080 });
      expect(result.outputPath).toContain('test-video_edited.mp4');

      // Verify spawn was called with correct arguments
      const spawnCalls = vi.mocked(spawn).mock.calls;
      expect(spawnCalls.length).toBe(1);
      expect(spawnCalls[0][0]).toBe('auto-editor');
      expect(spawnCalls[0][1][0]).toBe(inputPath);
      expect(spawnCalls[0][1][1]).toBe('--output');
      expect(spawnCalls[0][1][2]).toContain('test-video_edited.mp4');
      expect(spawnCalls[0][1][3]).toBe('--edit');
      expect(spawnCalls[0][1][4]).toBe('audio:threshold=0.04');
      expect(spawnCalls[0][1][5]).toBe('--margin');
      expect(spawnCalls[0][1][6]).toBe('0.2sec');
    });

    it('should verify output duration is shorter than input', async () => {
      const inputPath = '/temp/test-video.mp4';

      let callCount = 0;
      const mockFfprobe = vi.fn((filePath, callback) => {
        callCount++;
        const metadata = {
          streams: [
            {
              codec_type: 'video',
              width: 1920,
              height: 1080,
            },
          ],
          format: {
            // First call (input): 120s, Second call (output): 90s
            duration: callCount === 1 ? 120 : 90,
          },
        };
        callback(null, metadata);
      });
      vi.mocked(ffmpeg.ffprobe).mockImplementation(mockFfprobe as any);

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const result = await service.processVideo(inputPath);

      expect(result.inputDuration).toBe(120);
      expect(result.outputDuration).toBe(90);
      expect(result.outputDuration).toBeLessThanOrEqual(result.inputDuration);
    });

    it('should throw error if resolution is not preserved', async () => {
      const inputPath = '/temp/test-video.mp4';

      let callCount = 0;
      const mockFfprobe = vi.fn((filePath, callback) => {
        callCount++;
        const metadata = {
          streams: [
            {
              codec_type: 'video',
              // First call (input): 1920x1080, Second call (output): 1280x720
              width: callCount === 1 ? 1920 : 1280,
              height: callCount === 1 ? 1080 : 720,
            },
          ],
          format: {
            duration: 120,
          },
        };
        callback(null, metadata);
      });
      vi.mocked(ffmpeg.ffprobe).mockImplementation(mockFfprobe as any);

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      await expect(service.processVideo(inputPath)).rejects.toThrow(ProcessingError);
    });

    it('should handle Auto Editor process failure', async () => {
      const inputPath = '/temp/test-video.mp4';

      const mockFfprobe = vi.fn((filePath, callback) => {
        const metadata = {
          streams: [
            {
              codec_type: 'video',
              width: 1920,
              height: 1080,
            },
          ],
          format: {
            duration: 120,
          },
        };
        callback(null, metadata);
      });
      vi.mocked(ffmpeg.ffprobe).mockImplementation(mockFfprobe as any);

      // Mock spawn to simulate Auto Editor failure
      mockProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Error processing video')), 5);
        }
        return mockProcess;
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // Exit code 1 = failure
        }
        return mockProcess;
      });

      await expect(service.processVideo(inputPath)).rejects.toThrow(ProcessingError);
      await expect(service.processVideo(inputPath)).rejects.toThrow(
        'Auto Editor exited with code 1'
      );
    });

    it('should handle spawn error', async () => {
      const inputPath = '/temp/test-video.mp4';

      const mockFfprobe = vi.fn((path, callback) => {
        const metadata = {
          streams: [
            {
              codec_type: 'video',
              width: 1920,
              height: 1080,
            },
          ],
          format: {
            duration: 120,
          },
        };
        callback(null, metadata);
      });
      vi.mocked(ffmpeg.ffprobe).mockImplementation(mockFfprobe as any);

      // Mock spawn to simulate process spawn error
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Command not found')), 5);
        }
        return mockProcess;
      });

      await expect(service.processVideo(inputPath)).rejects.toThrow(ProcessingError);
      await expect(service.processVideo(inputPath)).rejects.toThrow(
        'Failed to spawn Auto Editor'
      );
    });

    it('should use custom options when provided', async () => {
      const inputPath = '/temp/test-video.mp4';
      const customOptions = {
        margin: '0.5sec',
        threshold: 0.08,
        editMode: 'motion' as const,
      };

      const mockFfprobe = vi.fn((path, callback) => {
        const metadata = {
          streams: [
            {
              codec_type: 'video',
              width: 1920,
              height: 1080,
            },
          ],
          format: {
            duration: 120,
          },
        };
        callback(null, metadata);
      });
      vi.mocked(ffmpeg.ffprobe).mockImplementation(mockFfprobe as any);

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      await service.processVideo(inputPath, customOptions);

      // Verify spawn was called with correct arguments (platform-independent)
      const spawnCalls = vi.mocked(spawn).mock.calls;
      expect(spawnCalls.length).toBe(1);
      expect(spawnCalls[0][0]).toBe('auto-editor');
      expect(spawnCalls[0][1][0]).toBe(inputPath);
      expect(spawnCalls[0][1][1]).toBe('--output');
      expect(spawnCalls[0][1][2]).toContain('test-video_edited.mp4');
      expect(spawnCalls[0][1][3]).toBe('--edit');
      expect(spawnCalls[0][1][4]).toBe('motion:threshold=0.08');
      expect(spawnCalls[0][1][5]).toBe('--margin');
      expect(spawnCalls[0][1][6]).toBe('0.5sec');
    });

    it('should handle ffprobe error for input video', async () => {
      const inputPath = '/temp/test-video.mp4';

      const mockFfprobe = vi.fn((path, callback) => {
        callback(new Error('Failed to probe video'), null);
      });
      vi.mocked(ffmpeg.ffprobe).mockImplementation(mockFfprobe as any);

      await expect(service.processVideo(inputPath)).rejects.toThrow(ProcessingError);
    });
  });

  describe('outputExists', () => {
    it('should return true if output file exists', async () => {
      const inputPath = '/temp/test-video.mp4';
      
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const exists = await service.outputExists(inputPath);

      expect(exists).toBe(true);
      // Verify fs.access was called with a path containing the expected filename
      const accessCalls = vi.mocked(fs.access).mock.calls;
      expect(accessCalls.length).toBe(1);
      expect(accessCalls[0][0]).toContain('test-video_edited.mp4');
    });

    it('should return false if output file does not exist', async () => {
      const inputPath = '/temp/test-video.mp4';
      
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const exists = await service.outputExists(inputPath);

      expect(exists).toBe(false);
    });
  });
});
