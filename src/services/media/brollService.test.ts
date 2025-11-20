import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import fs from 'fs/promises';
import brollService from './brollService';

vi.mock('axios');
vi.mock('fs/promises');
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('BrollService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchVideos', () => {
    it('should search Pexels API and return videos', async () => {
      const mockResponse = {
        data: {
          videos: [
            {
              id: 123,
              duration: 10,
              video_files: [
                {
                  link: 'https://example.com/video1.mp4',
                  width: 1920,
                  height: 1080,
                },
              ],
            },
            {
              id: 456,
              duration: 5,
              video_files: [
                {
                  link: 'https://example.com/video2.mp4',
                  width: 1920,
                  height: 1080,
                },
              ],
            },
          ],
          total_results: 100,
        },
      };

      vi.mocked(axios.get).mockResolvedValue(mockResponse);

      const result = await brollService.searchVideos('nature', {
        orientation: 'landscape',
      });

      expect(result.videos).toHaveLength(2);
      expect(result.videos[0].id).toBe('pexels-123');
      expect(result.videos[0].duration).toBe(10);
      expect(result.totalFound).toBe(100);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.pexels.com/videos/search',
        expect.objectContaining({
          params: expect.objectContaining({
            query: 'nature',
            orientation: 'landscape',
          }),
        })
      );
    });

    it('should filter videos by minimum duration', async () => {
      const mockResponse = {
        data: {
          videos: [
            {
              id: 123,
              duration: 10,
              video_files: [
                {
                  link: 'https://example.com/video1.mp4',
                  width: 1920,
                  height: 1080,
                },
              ],
            },
            {
              id: 456,
              duration: 2, // Too short
              video_files: [
                {
                  link: 'https://example.com/video2.mp4',
                  width: 1920,
                  height: 1080,
                },
              ],
            },
          ],
          total_results: 2,
        },
      };

      vi.mocked(axios.get).mockResolvedValue(mockResponse);

      const result = await brollService.searchVideos('nature', {
        minDuration: 5,
      });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0].duration).toBe(10);
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('API Error'));

      await expect(
        brollService.searchVideos('nature')
      ).rejects.toThrow('Pexels search failed');
    });
  });

  describe('downloadVideo', () => {
    it('should download video and save to cache', async () => {
      const mockVideo = {
        id: 'pexels-123',
        url: 'https://example.com/video.mp4',
        duration: 10,
        width: 1920,
        height: 1080,
        provider: 'pexels' as const,
      };

      const mockVideoData = Buffer.from('video data');

      vi.mocked(fs.stat).mockRejectedValueOnce(new Error('Not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(axios.get).mockResolvedValue({ data: mockVideoData });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1000 } as any);

      const result = await brollService.downloadVideo(mockVideo);

      expect(result.video).toEqual(mockVideo);
      expect(result.localPath).toContain('broll-');
      expect(result.localPath).toContain('.mp4');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should use cached video if available', async () => {
      const mockVideo = {
        id: 'pexels-123',
        url: 'https://example.com/video.mp4',
        duration: 10,
        width: 1920,
        height: 1080,
        provider: 'pexels' as const,
      };

      vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any);

      const result = await brollService.downloadVideo(mockVideo);

      expect(result.video).toEqual(mockVideo);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should clean up failed downloads', async () => {
      const mockVideo = {
        id: 'pexels-123',
        url: 'https://example.com/video.mp4',
        duration: 10,
        width: 1920,
        height: 1080,
        provider: 'pexels' as const,
      };

      vi.mocked(fs.stat).mockRejectedValueOnce(new Error('Not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(axios.get).mockRejectedValue(new Error('Download failed'));
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await expect(
        brollService.downloadVideo(mockVideo)
      ).rejects.toThrow('B-roll download failed');

      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('generateTransition', () => {
    it('should generate fade transition for first clip', () => {
      const transition = brollService.generateTransition(0, 5);
      expect(transition.type).toBe('fade');
      expect(transition.duration).toBe(0.5);
    });

    it('should generate fade transition for last clip', () => {
      const transition = brollService.generateTransition(4, 5);
      expect(transition.type).toBe('fade');
      expect(transition.duration).toBe(0.5);
    });

    it('should alternate transitions for middle clips', () => {
      const transition1 = brollService.generateTransition(1, 5);
      const transition2 = brollService.generateTransition(2, 5);
      
      expect(transition1.type).not.toBe(transition2.type);
    });
  });

  describe('handleMissingBroll', () => {
    it('should attempt fallback search with generic terms', async () => {
      const mockSearchResponse = {
        data: {
          videos: [
            {
              id: 999,
              duration: 10,
              video_files: [
                {
                  link: 'https://example.com/fallback.mp4',
                  width: 1920,
                  height: 1080,
                },
              ],
            },
          ],
          total_results: 1,
        },
      };

      const mockDownloadResponse = { data: Buffer.from('video data') };

      // Mock search API call
      vi.mocked(axios.get)
        .mockResolvedValueOnce(mockSearchResponse)
        .mockResolvedValueOnce(mockSearchResponse)
        .mockResolvedValueOnce(mockSearchResponse);

      // Mock file system operations for download
      vi.mocked(fs.stat)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({ size: 1000 } as any);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      
      // Mock download
      vi.mocked(axios.get).mockResolvedValue(mockDownloadResponse);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await brollService.handleMissingBroll(['failed term']);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array if fallback also fails', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('API Error'));

      const result = await brollService.handleMissingBroll(['failed term']);

      expect(result).toEqual([]);
    });
  });
});
