import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('BrollService');

export interface BrollVideo {
  id: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  provider: 'pexels';
}

export interface BrollSearchResult {
  videos: BrollVideo[];
  totalFound: number;
}

export interface BrollDownloadResult {
  localPath: string;
  video: BrollVideo;
}

export interface BrollTransition {
  type: 'fade' | 'slide' | 'none';
  duration: number;
}

class BrollService {
  private readonly pexelsApiKey: string;
  private readonly cacheDir: string;
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  constructor() {
    this.pexelsApiKey = config.pexels.apiKey;
    this.cacheDir = path.join(config.storage.cacheDir, 'broll');
  }

  /**
   * Search for B-roll videos on Pexels
   */
  async searchVideos(
    searchTerm: string,
    options: {
      minDuration?: number;
      orientation?: 'landscape' | 'portrait' | 'square';
      perPage?: number;
    } = {}
  ): Promise<BrollSearchResult> {
    const {
      minDuration = 3,
      orientation = 'landscape',
      perPage = 20,
    } = options;

    try {
      logger.info(`Searching Pexels for: "${searchTerm}" (${orientation})`);

      const response = await axios.get('https://api.pexels.com/videos/search', {
        headers: {
          Authorization: this.pexelsApiKey,
          'User-Agent': this.userAgent,
        },
        params: {
          query: searchTerm,
          per_page: perPage,
          orientation,
        },
        timeout: 30000,
      });

      const videos: BrollVideo[] = [];
      
      if (response.data.videos) {
        for (const video of response.data.videos) {
          // Check minimum duration
          if (video.duration < minDuration) {
            continue;
          }

          // Find best quality video file matching orientation
          const targetResolution = this.getTargetResolution(orientation);
          const videoFile = this.findBestVideoFile(
            video.video_files,
            targetResolution
          );

          if (videoFile) {
            videos.push({
              id: `pexels-${video.id}`,
              url: videoFile.link,
              duration: video.duration,
              width: videoFile.width,
              height: videoFile.height,
              provider: 'pexels',
            });
          }
        }
      }

      logger.info(`Found ${videos.length} suitable videos for "${searchTerm}"`);

      return {
        videos,
        totalFound: response.data.total_results || 0,
      };
    } catch (error) {
      logger.error(`Failed to search Pexels: ${error}`);
      throw new Error(`Pexels search failed: ${error}`);
    }
  }

  /**
   * Download B-roll video and cache it (with Wasabi storage integration)
   */
  async downloadVideo(video: BrollVideo, searchTerm: string = ''): Promise<BrollDownloadResult> {
    // Check if already cached locally
    const cachedPath = await this.getCachedVideoPath(video.url);
    if (cachedPath) {
      logger.info(`Using cached B-roll: ${cachedPath}`);
      return { localPath: cachedPath, video };
    }

    // Ensure cache directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Generate cache filename
    const urlHash = this.hashUrl(video.url);
    const filename = `broll-${urlHash}.mp4`;
    const localPath = path.join(this.cacheDir, filename);

    try {
      logger.info(`Downloading B-roll from: ${video.url}`);

      const response = await axios.get(video.url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 240000, // 4 minutes
      });

      await fs.writeFile(localPath, response.data);

      // Verify file was written successfully
      const stats = await fs.stat(localPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      logger.info(`B-roll downloaded: ${localPath} (${stats.size} bytes)`);

      // Upload to Wasabi storage for deduplication tracking
      try {
        const wasabiStorageService = (await import('../storage/wasabiStorageService')).default;
        await wasabiStorageService.uploadBroll(localPath, searchTerm || video.id);
        logger.info(`B-roll uploaded to Wasabi storage for tracking`);
      } catch (uploadError) {
        logger.warn(`Failed to upload B-roll to Wasabi (non-critical): ${uploadError}`);
        // Continue even if upload fails - local cache still works
      }

      return { localPath, video };
    } catch (error) {
      // Clean up failed download
      try {
        await fs.unlink(localPath);
      } catch {}

      logger.error(`Failed to download B-roll: ${error}`);
      throw new Error(`B-roll download failed: ${error}`);
    }
  }

  /**
   * Download multiple B-roll videos for given search terms
   */
  async downloadMultipleVideos(
    searchTerms: string[],
    options: {
      targetDuration: number;
      maxClipDuration?: number;
      orientation?: 'landscape' | 'portrait' | 'square';
    }
  ): Promise<BrollDownloadResult[]> {
    const {
      targetDuration,
      maxClipDuration = 5,
      orientation = 'landscape',
    } = options;

    const allVideos: BrollVideo[] = [];
    const downloadedVideos: BrollDownloadResult[] = [];
    let totalDuration = 0;

    // Search for videos from all terms
    for (const term of searchTerms) {
      try {
        const result = await this.searchVideos(term, {
          minDuration: maxClipDuration,
          orientation,
          perPage: 20,
        });

        allVideos.push(...result.videos);
      } catch (error) {
        logger.warn(`Failed to search for "${term}": ${error}`);
      }
    }

    // Remove duplicates
    const uniqueVideos = this.deduplicateVideos(allVideos);

    logger.info(
      `Found ${uniqueVideos.length} unique videos, need ${targetDuration}s total`
    );

    // Download videos until we have enough duration
    for (let i = 0; i < uniqueVideos.length; i++) {
      const video = uniqueVideos[i];
      if (totalDuration >= targetDuration) {
        break;
      }

      try {
        const searchTerm = searchTerms[i % searchTerms.length] || '';
        const result = await this.downloadVideo(video, searchTerm);
        downloadedVideos.push(result);

        const clipDuration = Math.min(maxClipDuration, video.duration);
        totalDuration += clipDuration;

        logger.info(
          `Downloaded ${downloadedVideos.length} videos, total: ${totalDuration.toFixed(1)}s / ${targetDuration}s`
        );
      } catch (error) {
        logger.warn(`Failed to download video ${video.id}: ${error}`);
      }
    }

    if (downloadedVideos.length === 0) {
      throw new Error('No B-roll videos could be downloaded');
    }

    logger.info(
      `Successfully downloaded ${downloadedVideos.length} B-roll videos (${totalDuration.toFixed(1)}s)`
    );

    return downloadedVideos;
  }

  /**
   * Generate transition for B-roll segment
   */
  generateTransition(index: number, total: number): BrollTransition {
    // First and last clips get fade transitions
    if (index === 0) {
      return { type: 'fade', duration: 0.5 };
    }
    if (index === total - 1) {
      return { type: 'fade', duration: 0.5 };
    }

    // Middle clips alternate between fade and slide
    const transitionType = index % 2 === 0 ? 'fade' : 'slide';
    return { type: transitionType, duration: 0.3 };
  }

  /**
   * Handle graceful fallback when B-roll is missing
   */
  async handleMissingBroll(searchTerms: string[]): Promise<BrollDownloadResult[]> {
    logger.warn('Attempting fallback B-roll search with generic terms');

    const fallbackTerms = ['nature', 'abstract', 'background'];
    
    try {
      return await this.downloadMultipleVideos(fallbackTerms, {
        targetDuration: 10,
        maxClipDuration: 5,
      });
    } catch (error) {
      logger.error('Fallback B-roll search also failed');
      return [];
    }
  }

  /**
   * Get target resolution based on orientation
   */
  private getTargetResolution(
    orientation: 'landscape' | 'portrait' | 'square'
  ): { width: number; height: number } {
    switch (orientation) {
      case 'landscape':
        return { width: 1920, height: 1080 };
      case 'portrait':
        return { width: 1080, height: 1920 };
      case 'square':
        return { width: 1080, height: 1080 };
    }
  }

  /**
   * Find best video file matching target resolution
   */
  private findBestVideoFile(
    videoFiles: any[],
    targetResolution: { width: number; height: number }
  ): any | null {
    // First try exact match
    for (const file of videoFiles) {
      if (
        file.width === targetResolution.width &&
        file.height === targetResolution.height
      ) {
        return file;
      }
    }

    // Then try closest match with same aspect ratio
    const targetRatio = targetResolution.width / targetResolution.height;
    let bestFile = null;
    let smallestDiff = Infinity;

    for (const file of videoFiles) {
      const fileRatio = file.width / file.height;
      const ratioDiff = Math.abs(fileRatio - targetRatio);

      if (ratioDiff < smallestDiff && file.width >= targetResolution.width * 0.8) {
        smallestDiff = ratioDiff;
        bestFile = file;
      }
    }

    return bestFile;
  }

  /**
   * Check if video is already cached
   */
  private async getCachedVideoPath(url: string): Promise<string | null> {
    const urlHash = this.hashUrl(url);
    const filename = `broll-${urlHash}.mp4`;
    const cachedPath = path.join(this.cacheDir, filename);

    try {
      const stats = await fs.stat(cachedPath);
      if (stats.size > 0) {
        return cachedPath;
      }
    } catch {
      // File doesn't exist
    }

    return null;
  }

  /**
   * Generate MD5 hash of URL for caching
   */
  private hashUrl(url: string): string {
    const urlWithoutQuery = url.split('?')[0];
    return crypto.createHash('md5').update(urlWithoutQuery).digest('hex');
  }

  /**
   * Remove duplicate videos by URL
   */
  private deduplicateVideos(videos: BrollVideo[]): BrollVideo[] {
    const seen = new Set<string>();
    const unique: BrollVideo[] = [];

    for (const video of videos) {
      if (!seen.has(video.url)) {
        seen.add(video.url);
        unique.push(video);
      }
    }

    return unique;
  }
}

export default new BrollService();
