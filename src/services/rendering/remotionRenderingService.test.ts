import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemotionRenderingService } from './remotionRenderingService';
import { EditingPlan } from '../content-analysis/editingPlanService';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('@remotion/bundler');
vi.mock('@remotion/renderer');
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock('../../config', () => ({
  config: {
    storage: {
      tempDir: '/tmp',
      cacheDir: '/cache',
    },
  },
}));

describe('RemotionRenderingService', () => {
  let service: RemotionRenderingService;

  beforeEach(() => {
    service = new RemotionRenderingService();
    vi.clearAllMocks();
  });

  describe('renderVideo', () => {
    it('should validate input before rendering', async () => {
      const input = {
        videoPath: '/path/to/video.mp4',
        editingPlan: {
          highlights: [],
          animations: [],
          transitions: [],
          brollPlacements: [],
        } as EditingPlan,
        outputPath: '/path/to/output.mp4',
      };

      // Mock file access to fail
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await expect(service.renderVideo(input)).rejects.toThrow(
        'Video file not found'
      );
    });

    it('should validate animation templates exist', async () => {
      const input = {
        videoPath: '/path/to/video.mp4',
        editingPlan: {
          highlights: [],
          animations: [
            {
              startTime: 1.0,
              duration: 2.0,
              template: 'non-existent-template',
              parameters: {},
            },
          ],
          transitions: [],
          brollPlacements: [],
        } as EditingPlan,
        outputPath: '/path/to/output.mp4',
      };

      // Mock file access to succeed
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await expect(service.renderVideo(input)).rejects.toThrow(
        'Animation template does not exist'
      );
    });

    it('should validate B-roll video files exist', async () => {
      const input = {
        videoPath: '/path/to/video.mp4',
        editingPlan: {
          highlights: [],
          animations: [],
          transitions: [],
          brollPlacements: [],
        } as EditingPlan,
        outputPath: '/path/to/output.mp4',
        brollVideos: [
          {
            startTime: 1.0,
            duration: 2.0,
            videoPath: '/path/to/broll.mp4',
          },
        ],
      };

      // Mock main video exists but B-roll doesn't
      vi.mocked(fs.access).mockImplementation((path: any) => {
        if (path.includes('broll')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve(undefined);
      });

      await expect(service.renderVideo(input)).rejects.toThrow(
        'B-roll video not found'
      );
    });
  });

  describe('parseSRT', () => {
    it('should parse valid SRT file', async () => {
      const srtContent = `1
00:00:01,000 --> 00:00:03,000
First subtitle

2
00:00:03,500 --> 00:00:05,000
Second subtitle`;

      vi.mocked(fs.readFile).mockResolvedValue(srtContent);

      const service = new RemotionRenderingService();
      const result = await (service as any).parseSRT('/path/to/file.srt');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        startTime: 1.0,
        endTime: 3.0,
        text: 'First subtitle',
      });
      expect(result[1]).toEqual({
        startTime: 3.5,
        endTime: 5.0,
        text: 'Second subtitle',
      });
    });

    it('should handle multi-line subtitles', async () => {
      const srtContent = `1
00:00:01,000 --> 00:00:03,000
First line
Second line`;

      vi.mocked(fs.readFile).mockResolvedValue(srtContent);

      const service = new RemotionRenderingService();
      const result = await (service as any).parseSRT('/path/to/file.srt');

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('First line Second line');
    });
  });

  describe('validateEditingPlanTimestamps', () => {
    it('should warn when animation extends beyond video duration', () => {
      const plan: EditingPlan = {
        highlights: [],
        animations: [
          {
            startTime: 9.0,
            duration: 2.0, // Ends at 11.0, beyond 10.0 duration
            template: 'animated-text',
            parameters: {},
          },
        ],
        transitions: [],
        brollPlacements: [],
      };

      const service = new RemotionRenderingService();
      
      // Should not throw, just warn
      expect(() => {
        (service as any).validateEditingPlanTimestamps(plan, 10.0);
      }).not.toThrow();
    });

    it('should warn when highlight extends beyond video duration', () => {
      const plan: EditingPlan = {
        highlights: [
          {
            startTime: 9.0,
            endTime: 11.0, // Beyond 10.0 duration
            effectType: 'zoom',
            parameters: {},
          },
        ],
        animations: [],
        transitions: [],
        brollPlacements: [],
      };

      const service = new RemotionRenderingService();
      
      // Should not throw, just warn
      expect(() => {
        (service as any).validateEditingPlanTimestamps(plan, 10.0);
      }).not.toThrow();
    });

    it('should warn when B-roll extends beyond video duration', () => {
      const plan: EditingPlan = {
        highlights: [],
        animations: [],
        transitions: [],
        brollPlacements: [
          {
            startTime: 9.0,
            duration: 2.0, // Ends at 11.0, beyond 10.0 duration
            searchTerm: 'nature',
          },
        ],
      };

      const service = new RemotionRenderingService();
      
      // Should not throw, just warn
      expect(() => {
        (service as any).validateEditingPlanTimestamps(plan, 10.0);
      }).not.toThrow();
    });
  });

  describe('createCompositionData', () => {
    it('should create composition data with all required fields', () => {
      const input = {
        videoPath: '/path/to/video.mp4',
        editingPlan: {
          highlights: [],
          animations: [],
          transitions: [],
          brollPlacements: [],
        } as EditingPlan,
        outputPath: '/path/to/output.mp4',
      };

      const videoMetadata = {
        width: 1920,
        height: 1080,
        duration: 10.0,
      };

      const subtitles = [
        { startTime: 1.0, endTime: 3.0, text: 'Test subtitle' },
      ];

      const service = new RemotionRenderingService();
      const result = (service as any).createCompositionData(
        input,
        videoMetadata,
        subtitles
      );

      expect(result).toEqual({
        videoPath: input.videoPath,
        videoDuration: videoMetadata.duration,
        videoWidth: videoMetadata.width,
        videoHeight: videoMetadata.height,
        editingPlan: input.editingPlan,
        subtitles,
        brollVideos: [],
      });
    });

    it('should include B-roll videos in composition data', () => {
      const brollVideos = [
        {
          startTime: 1.0,
          duration: 2.0,
          videoPath: '/path/to/broll.mp4',
        },
      ];

      const input = {
        videoPath: '/path/to/video.mp4',
        editingPlan: {
          highlights: [],
          animations: [],
          transitions: [],
          brollPlacements: [],
        } as EditingPlan,
        outputPath: '/path/to/output.mp4',
        brollVideos,
      };

      const videoMetadata = {
        width: 1920,
        height: 1080,
        duration: 10.0,
      };

      const service = new RemotionRenderingService();
      const result = (service as any).createCompositionData(
        input,
        videoMetadata,
        []
      );

      expect(result.brollVideos).toEqual(brollVideos);
    });
  });
});
