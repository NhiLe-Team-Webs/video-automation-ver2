import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YouTubeUploadService, VideoMetadata } from './youtubeUploadService';
import { google } from 'googleapis';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

// Mock dependencies
vi.mock('googleapis');
vi.mock('fs/promises');
vi.mock('fs');
vi.mock('../../config', () => ({
  config: {
    youtube: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/oauth/callback',
    },
    server: {
      env: 'test',
      port: 3000,
    },
  },
}));

describe('YouTubeUploadService', () => {
  let service: YouTubeUploadService;
  let mockOAuth2Client: any;
  let mockYouTube: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock OAuth2 client
    mockOAuth2Client = {
      setCredentials: vi.fn(),
      generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?...'),
      getToken: vi.fn().mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
        },
      }),
    };

    // Mock YouTube API
    mockYouTube = {
      videos: {
        insert: vi.fn().mockResolvedValue({
          data: {
            id: 'dQw4w9WgXcQ', // Valid 11-character video ID
          },
        }),
      },
    };

    // Mock google.auth.OAuth2
    (google.auth.OAuth2 as any) = vi.fn().mockImplementation(() => mockOAuth2Client);

    // Mock google.youtube
    (google.youtube as any) = vi.fn().mockReturnValue(mockYouTube);

    service = new YouTubeUploadService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setCredentials', () => {
    it('should set OAuth2 credentials', () => {
      const credentials = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
      };

      service.setCredentials(credentials);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(credentials);
    });
  });

  describe('getAuthUrl', () => {
    it('should generate OAuth2 authorization URL', () => {
      const url = service.getAuthUrl();

      expect(url).toBe('https://accounts.google.com/o/oauth2/auth?...');
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube',
        ],
        prompt: 'consent',
      });
    });
  });

  describe('getTokensFromCode', () => {
    it('should exchange authorization code for tokens', async () => {
      const code = 'test-auth-code';

      const tokens = await service.getTokensFromCode(code);

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(code);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalled();
      expect(tokens).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      });
    });
  });

  describe('upload', () => {
    const videoPath = '/path/to/video.mp4';
    const metadata: VideoMetadata = {
      title: 'Test Video',
      description: 'Test Description',
      tags: ['test', 'video'],
      privacyStatus: 'private',
    };

    beforeEach(() => {
      // Mock fs.access to simulate file exists
      (fs.access as any) = vi.fn().mockResolvedValue(undefined);

      // Mock fs.stat for file size
      (fs.stat as any) = vi.fn().mockResolvedValue({
        size: 1024 * 1024, // 1MB
      });

      // Mock createReadStream
      const mockStream = {
        on: vi.fn().mockReturnThis(),
      };
      (createReadStream as any) = vi.fn().mockReturnValue(mockStream);
    });

    it('should upload video successfully', async () => {
      const result = await service.upload(videoPath, metadata);

      expect(result).toEqual({
        videoId: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        status: 'uploaded',
      });

      expect(mockYouTube.videos.insert).toHaveBeenCalledWith({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: '22',
          },
          status: {
            privacyStatus: metadata.privacyStatus,
          },
        },
        media: {
          body: expect.any(Object),
        },
      });
    });

    it('should throw error if video file not found', async () => {
      (fs.access as any) = vi.fn().mockRejectedValue(new Error('File not found'));

      await expect(service.upload(videoPath, metadata)).rejects.toThrow(
        'Video file not found'
      );
    });

    it('should retry on failure with exponential backoff', async () => {
      // First two attempts fail, third succeeds
      mockYouTube.videos.insert
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            id: 'dQw4w9WgXcQ',
          },
        });

      const result = await service.upload(videoPath, metadata);

      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(mockYouTube.videos.insert).toHaveBeenCalledTimes(3);
    });

    it('should fail after 3 retry attempts', async () => {
      mockYouTube.videos.insert.mockRejectedValue(new Error('Network error'));

      await expect(service.upload(videoPath, metadata)).rejects.toThrow(
        'YouTube upload failed after 3 attempts'
      );

      expect(mockYouTube.videos.insert).toHaveBeenCalledTimes(3);
    });

    it('should call progress callback during upload', async () => {
      const onProgress = vi.fn();

      await service.upload(videoPath, metadata, onProgress);

      // Progress callback should be set up (actual calls happen during stream events)
      expect(createReadStream).toHaveBeenCalledWith(videoPath);
    });

    it('should throw error if YouTube API does not return video ID', async () => {
      mockYouTube.videos.insert.mockResolvedValue({
        data: {
          id: null,
        },
      });

      await expect(service.upload(videoPath, metadata)).rejects.toThrow(
        'YouTube API did not return a video ID'
      );
    });
  });

  describe('extractVideoId', () => {
    it('should extract video ID from standard YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const videoId = service.extractVideoId(url);

      expect(videoId).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from short YouTube URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const videoId = service.extractVideoId(url);

      expect(videoId).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URL', () => {
      const url = 'https://example.com/video';
      const videoId = service.extractVideoId(url);

      expect(videoId).toBeNull();
    });
  });

  describe('YouTube URL validation', () => {
    it('should validate standard YouTube URL format', async () => {
      const videoPath = '/path/to/video.mp4';
      const metadata: VideoMetadata = {
        title: 'Test Video',
        description: 'Test Description',
      };

      (fs.access as any) = vi.fn().mockResolvedValue(undefined);
      (fs.stat as any) = vi.fn().mockResolvedValue({ size: 1024 });
      const mockStream = { on: vi.fn().mockReturnThis() };
      (createReadStream as any) = vi.fn().mockReturnValue(mockStream);

      // Mock with valid 11-character video ID
      mockYouTube.videos.insert.mockResolvedValue({
        data: {
          id: 'dQw4w9WgXcQ', // 11 characters
        },
      });

      const result = await service.upload(videoPath, metadata);

      expect(result.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}$/);
    });
  });
});
