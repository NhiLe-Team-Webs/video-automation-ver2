/**
 * Mock YouTube Upload Service
 * 
 * For testing without real YouTube credentials
 * Simulates successful upload and returns mock data
 */

import { createLogger } from '../../utils/logger';
import { VideoMetadata, YouTubeResult, UploadProgress } from './youtubeUploadService';

const logger = createLogger('MockYouTubeUploadService');

export class MockYouTubeUploadService {
  /**
   * Mock upload - simulates successful upload
   */
  async upload(
    videoPath: string,
    metadata: VideoMetadata,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<YouTubeResult> {
    logger.info('🎬 Mock YouTube Upload Started', {
      videoPath,
      title: metadata.title,
      privacyStatus: metadata.privacyStatus || 'private',
    });

    // Simulate upload progress
    const totalBytes = 50000000; // 50MB mock size
    const steps = 10;

    for (let i = 0; i <= steps; i++) {
      const bytesUploaded = Math.floor((totalBytes * i) / steps);
      const percentage = (i / steps) * 100;

      if (onProgress) {
        onProgress({
          bytesUploaded,
          totalBytes,
          percentage,
        });
      }

      logger.info('Upload progress', {
        percentage: `${percentage.toFixed(1)}%`,
        bytesUploaded: `${(bytesUploaded / 1024 / 1024).toFixed(2)} MB`,
      });

      // Simulate delay
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Generate mock video ID
    const mockVideoId = `MOCK_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const mockUrl = `https://www.youtube.com/watch?v=${mockVideoId}`;

    logger.info('✅ Mock YouTube Upload Completed', {
      videoId: mockVideoId,
      url: mockUrl,
    });

    return {
      videoId: mockVideoId,
      url: mockUrl,
      status: 'uploaded',
    };
  }

  /**
   * Mock method to check if credentials are configured
   */
  hasCredentials(): boolean {
    return true; // Always return true for mock
  }
}
