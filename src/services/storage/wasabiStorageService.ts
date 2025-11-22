import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('WasabiStorageService');

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  etag?: string;
}

export interface DownloadResult {
  localPath: string;
  size: number;
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

export interface MediaMetadata {
  key: string;
  hash: string;
  size: number;
  uploadedAt: Date;
  category: 'video' | 'broll' | 'sfx' | 'image';
}

/**
 * Wasabi Storage Service - S3-compatible object storage
 * Manages video uploads, B-roll, sound effects, and images
 */
export class WasabiStorageService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;
  private metadataCache: Map<string, MediaMetadata> = new Map();

  constructor() {
    this.bucket = config.storage.wasabi.bucket;
    this.region = config.storage.wasabi.region;

    // Initialize S3 client with Wasabi endpoint
    this.s3Client = new S3Client({
      region: this.region,
      endpoint: `https://s3.${this.region}.wasabisys.com`,
      credentials: {
        accessKeyId: config.storage.wasabi.accessKeyId,
        secretAccessKey: config.storage.wasabi.secretAccessKey,
      },
    });

    logger.info('Wasabi Storage Service initialized', {
      bucket: this.bucket,
      region: this.region,
    });
  }

  /**
   * Upload file to Wasabi storage with retry logic
   */
  async uploadFile(
    localPath: string,
    key: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Uploading file to Wasabi', {
          localPath,
          key,
          bucket: this.bucket,
          attempt,
          maxRetries,
        });

        // Get file stats
        const stats = await fs.stat(localPath);
        const fileSize = stats.size;

        // Read file as buffer for better reliability with large files
        const fileBuffer = await fs.readFile(localPath);

        // Upload to Wasabi
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: fileBuffer,
          Metadata: metadata,
          ContentType: this.getContentType(localPath),
        });

        const response = await this.s3Client.send(command);

        const url = `https://s3.${this.region}.wasabisys.com/${this.bucket}/${key}`;

        logger.info('File uploaded successfully', {
          key,
          size: fileSize,
          etag: response.ETag,
          url,
          attempt,
        });

        return {
          key,
          url,
          size: fileSize,
          etag: response.ETag,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn('Upload attempt failed', {
          localPath,
          key,
          attempt,
          maxRetries,
          error: lastError.message,
        });

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          logger.error('Non-retryable error, aborting upload', {
            localPath,
            key,
            error: lastError.message,
          });
          throw lastError;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          logger.info('Waiting before retry', {
            localPath,
            key,
            delayMs,
          });
          await this.delay(delayMs);
        }
      }
    }

    // All retries failed
    logger.error('Failed to upload file to Wasabi after all retries', {
      localPath,
      key,
      attempts: maxRetries,
      error: lastError?.message,
    });
    throw lastError || new Error('Upload failed after all retries');
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Don't retry on authentication/authorization errors
    if (message.includes('access denied') || 
        message.includes('invalid access key') ||
        message.includes('signature does not match')) {
      return true;
    }

    // Don't retry on invalid bucket errors
    if (message.includes('nosuchbucket') || 
        message.includes('bucket not found')) {
      return true;
    }

    return false;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate signed URL for downloading file
   */
  async getSignedUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    const { expiresIn = 3600 } = options;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      logger.info('Generated signed URL', {
        key,
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if file exists in storage
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      logger.info('Deleting file from Wasabi', {
        key,
        bucket: this.bucket,
      });

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);

      logger.info('File deleted successfully', { key });
    } catch (error) {
      logger.error('Failed to delete file from Wasabi', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate file hash (MD5)
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  /**
   * Upload video with deduplication check
   */
  async uploadVideo(
    localPath: string,
    jobId: string,
    category: 'final' | 'raw' | 'edited' = 'final'
  ): Promise<UploadResult> {
    const stats = await fs.stat(localPath);
    const fileSize = stats.size;
    
    logger.info('Preparing video upload', {
      localPath,
      jobId,
      category,
      fileSize: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
    });

    const hash = await this.calculateFileHash(localPath);
    const ext = path.extname(localPath);
    const key = `videos/${category}/${jobId}${ext}`;

    // Check if file with same hash already exists
    const existingKey = await this.findByHash(hash, 'video');
    if (existingKey) {
      logger.info('Video already exists in storage, skipping upload', {
        existingKey,
        hash,
      });

      // Return existing file info
      return {
        key: existingKey,
        url: await this.getSignedUrl(existingKey),
        size: fileSize,
      };
    }

    // Upload new file
    const result = await this.uploadFile(localPath, key, {
      hash,
      category: 'video',
      jobId,
    });

    // Cache metadata
    this.metadataCache.set(key, {
      key,
      hash,
      size: result.size,
      uploadedAt: new Date(),
      category: 'video',
    });

    return result;
  }

  /**
   * Upload B-roll with deduplication check
   */
  async uploadBroll(
    localPath: string,
    searchTerm: string
  ): Promise<UploadResult> {
    const hash = await this.calculateFileHash(localPath);
    const ext = path.extname(localPath);
    const sanitizedTerm = searchTerm.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const key = `broll/${sanitizedTerm}-${hash.substring(0, 8)}${ext}`;

    // Check if B-roll with same hash already exists
    const existingKey = await this.findByHash(hash, 'broll');
    if (existingKey) {
      logger.info('B-roll already exists in storage, skipping upload', {
        existingKey,
        hash,
        searchTerm,
      });

      return {
        key: existingKey,
        url: await this.getSignedUrl(existingKey),
        size: (await fs.stat(localPath)).size,
      };
    }

    // Upload new B-roll
    const result = await this.uploadFile(localPath, key, {
      hash,
      category: 'broll',
      searchTerm,
    });

    // Cache metadata
    this.metadataCache.set(key, {
      key,
      hash,
      size: result.size,
      uploadedAt: new Date(),
      category: 'broll',
    });

    return result;
  }

  /**
   * Upload sound effect with deduplication check
   */
  async uploadSoundEffect(
    localPath: string,
    category: string
  ): Promise<UploadResult> {
    const hash = await this.calculateFileHash(localPath);
    const ext = path.extname(localPath);
    const key = `sfx/${category}/${hash.substring(0, 8)}${ext}`;

    // Check if SFX with same hash already exists
    const existingKey = await this.findByHash(hash, 'sfx');
    if (existingKey) {
      logger.info('Sound effect already exists in storage, skipping upload', {
        existingKey,
        hash,
        category,
      });

      return {
        key: existingKey,
        url: await this.getSignedUrl(existingKey),
        size: (await fs.stat(localPath)).size,
      };
    }

    // Upload new SFX
    const result = await this.uploadFile(localPath, key, {
      hash,
      category: 'sfx',
      sfxCategory: category,
    });

    // Cache metadata
    this.metadataCache.set(key, {
      key,
      hash,
      size: result.size,
      uploadedAt: new Date(),
      category: 'sfx',
    });

    return result;
  }

  /**
   * Find file by hash to avoid duplicates
   */
  private async findByHash(
    hash: string,
    category: 'video' | 'broll' | 'sfx' | 'image'
  ): Promise<string | null> {
    // Check cache first
    for (const [key, metadata] of this.metadataCache.entries()) {
      if (metadata.hash === hash && metadata.category === category) {
        return key;
      }
    }

    // Search in storage
    try {
      const prefix = category === 'video' ? 'videos/' : category === 'broll' ? 'broll/' : 'sfx/';
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1000,
      });

      const response = await this.s3Client.send(command);

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            // Check if key contains hash
            if (object.Key.includes(hash.substring(0, 8))) {
              logger.info('Found existing file by hash', {
                key: object.Key,
                hash,
              });
              return object.Key;
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to search for existing file', {
        hash,
        category,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * List all files with prefix
   */
  async listFiles(prefix: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      return response.Contents?.map(obj => obj.Key || '').filter(key => key) || [];
    } catch (error) {
      logger.error('Failed to list files', {
        prefix,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete old files (cleanup)
   */
  async deleteOldFiles(prefix: string, olderThanDays: number): Promise<number> {
    try {
      const files = await this.listFiles(prefix);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedCount = 0;

      for (const key of files) {
        try {
          const command = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
          });

          const response = await this.s3Client.send(command);

          if (response.LastModified && response.LastModified < cutoffDate) {
            await this.deleteFile(key);
            deletedCount++;
          }
        } catch (error) {
          logger.warn('Failed to check/delete file', {
            key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('Cleanup completed', {
        prefix,
        deletedCount,
        olderThanDays,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete old files', {
        prefix,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export default new WasabiStorageService();
