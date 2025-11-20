import { google, youtube_v3 } from 'googleapis';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';
import { ProcessingError } from '../../utils/errors';

const logger = createLogger('YouTubeUploadService');

export interface VideoMetadata {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: 'public' | 'private' | 'unlisted';
}

export interface YouTubeResult {
  videoId: string;
  url: string;
  status: 'uploaded' | 'processing' | 'failed';
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

export class YouTubeUploadService {
  private youtube: youtube_v3.Youtube;
  private oauth2Client: any;

  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      config.youtube.clientId,
      config.youtube.clientSecret,
      config.youtube.redirectUri
    );

    // Initialize YouTube API client
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  /**
   * Set OAuth2 credentials (access token and refresh token)
   */
  setCredentials(credentials: { access_token: string; refresh_token?: string; expiry_date?: number }): void {
    this.oauth2Client.setCredentials(credentials);
    
    logger.info('OAuth2 credentials set', {
      hasAccessToken: !!credentials.access_token,
      hasRefreshToken: !!credentials.refresh_token,
    });
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
    });

    logger.info('Generated OAuth2 authorization URL');
    
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<any> {
    logger.info('Exchanging authorization code for tokens');
    
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    
    logger.info('Tokens obtained successfully', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    });
    
    return tokens;
  }

  /**
   * Upload video to YouTube with retry logic
   */
  async upload(
    videoPath: string,
    metadata: VideoMetadata,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<YouTubeResult> {
    const jobId = path.basename(videoPath, path.extname(videoPath));
    
    logger.info('Starting YouTube upload', {
      jobId,
      videoPath,
      title: metadata.title,
    });

    // Validate video file exists
    try {
      await fs.access(videoPath);
    } catch (error) {
      throw new ProcessingError(
        `Video file not found: ${videoPath}`,
        {
          jobId,
          stage: 'uploading',
          attemptNumber: 0,
        }
      );
    }

    // Retry logic with exponential backoff
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info('Upload attempt', {
          jobId,
          attempt,
          maxAttempts,
        });

        const result = await this.uploadVideo(videoPath, metadata, onProgress);

        logger.info('Upload completed successfully', {
          jobId,
          attempt,
          videoId: result.videoId,
          url: result.url,
        });

        // Validate YouTube link format
        this.validateYouTubeUrl(result.url);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn('Upload attempt failed', {
          jobId,
          attempt,
          maxAttempts,
          error: lastError.message,
        });

        // Don't wait after the last attempt
        if (attempt < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          logger.info('Waiting before retry', {
            jobId,
            delayMs,
          });
          await this.delay(delayMs);
        }
      }
    }

    // All attempts failed
    const errorMessage = `YouTube upload failed after ${maxAttempts} attempts: ${lastError?.message}`;
    logger.error('Upload failed', {
      jobId,
      attempts: maxAttempts,
      error: lastError?.message,
    });

    throw new ProcessingError(errorMessage, {
      jobId,
      stage: 'uploading',
      attemptNumber: maxAttempts,
    });
  }

  /**
   * Upload video to YouTube (single attempt)
   */
  private async uploadVideo(
    videoPath: string,
    metadata: VideoMetadata,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<YouTubeResult> {
    const jobId = path.basename(videoPath, path.extname(videoPath));

    // Get file size for progress tracking
    const stats = await fs.stat(videoPath);
    const fileSize = stats.size;

    logger.info('Uploading video to YouTube', {
      jobId,
      fileSize,
      title: metadata.title,
    });

    // Create read stream
    const videoStream = createReadStream(videoPath);

    // Track upload progress
    let bytesUploaded = 0;
    videoStream.on('data', (chunk) => {
      bytesUploaded += chunk.length;
      const percentage = Math.round((bytesUploaded / fileSize) * 100);
      
      if (onProgress) {
        onProgress({
          bytesUploaded,
          totalBytes: fileSize,
          percentage,
        });
      }

      logger.debug('Upload progress', {
        jobId,
        bytesUploaded,
        totalBytes: fileSize,
        percentage,
      });
    });

    // Upload video
    const response = await this.youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags || [],
          categoryId: metadata.categoryId || '22', // Default to "People & Blogs"
        },
        status: {
          privacyStatus: metadata.privacyStatus || 'private',
        },
      },
      media: {
        body: videoStream,
      },
    });

    // Extract video ID
    const videoId = response.data.id;
    if (!videoId) {
      throw new Error('YouTube API did not return a video ID');
    }

    // Generate YouTube URL
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    logger.info('Video uploaded successfully', {
      jobId,
      videoId,
      url,
    });

    return {
      videoId,
      url,
      status: 'uploaded',
    };
  }

  /**
   * Validate YouTube URL format
   */
  private validateYouTubeUrl(url: string): void {
    // YouTube URL patterns:
    // https://www.youtube.com/watch?v=VIDEO_ID (11 characters)
    // https://youtu.be/VIDEO_ID (11 characters)
    
    const patterns = [
      /^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}$/,
      /^https:\/\/youtu\.be\/[a-zA-Z0-9_-]{11}$/,
    ];

    const isValid = patterns.some(pattern => pattern.test(url));

    if (!isValid) {
      throw new Error(`Invalid YouTube URL format: ${url}`);
    }

    logger.debug('YouTube URL validation passed', { url });
  }

  /**
   * Extract video ID from YouTube URL
   */
  extractVideoId(url: string): string | null {
    // Pattern 1: https://www.youtube.com/watch?v=VIDEO_ID
    const match1 = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match1) {
      return match1[1];
    }

    // Pattern 2: https://youtu.be/VIDEO_ID
    const match2 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match2) {
      return match2[1];
    }

    return null;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
