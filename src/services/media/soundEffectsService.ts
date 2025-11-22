import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SoundEffectsService');

export type SoundEffectCategory = 'whoosh' | 'pop' | 'transition' | 'zoom' | 'text-appear';

export interface SoundEffect {
  id: string;
  url: string;
  duration: number;
  category: SoundEffectCategory;
  volumeLevel: number; // 0.0 to 1.0
  name: string;
  provider: 'pixabay';
}

export interface SoundEffectSearchResult {
  effects: SoundEffect[];
  totalFound: number;
}

export interface SoundEffectDownloadResult {
  localPath: string;
  effect: SoundEffect;
}

export interface AudioTrack {
  path: string;
  peakVolume: number;
  averageVolume: number;
}

export interface VolumeValidation {
  isValid: boolean;
  mainAudioPeak: number;
  sfxPeak: number;
  recommendedSfxVolume: number;
}

class SoundEffectsService {
  private readonly pixabayApiKey: string;
  private readonly cacheDir: string;
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  // Category-specific search terms for better results
  private readonly categorySearchTerms: Record<SoundEffectCategory, string[]> = {
    'whoosh': ['whoosh', 'swish', 'swoosh', 'wind'],
    'pop': ['pop', 'bubble', 'click', 'snap'],
    'transition': ['transition', 'swoosh', 'slide'],
    'zoom': ['zoom', 'whoosh', 'fast'],
    'text-appear': ['notification', 'ding', 'chime', 'bell'],
  };

  constructor() {
    this.pixabayApiKey = config.soundEffects.apiKey;
    this.cacheDir = path.join(config.storage.cacheDir, 'sfx');
  }

  /**
   * Search for sound effects on Pixabay
   */
  async searchSoundEffect(
    category: SoundEffectCategory,
    duration: number,
    options: {
      maxResults?: number;
    } = {}
  ): Promise<SoundEffectSearchResult> {
    const { maxResults = 20 } = options;

    try {
      const searchTerms = this.categorySearchTerms[category];
      const query = searchTerms[0]; // Pixabay uses single query, not OR

      logger.info(`Searching Pixabay for ${category}: "${query}"`);

      const response = await axios.get('https://pixabay.com/api/', {
        headers: {
          'User-Agent': this.userAgent,
        },
        params: {
          key: this.pixabayApiKey,
          q: query,
          audio_type: 'sound_effect',
          per_page: maxResults,
        },
        timeout: 30000,
      });

      const effects: SoundEffect[] = [];

      if (response.data.hits) {
        for (const sound of response.data.hits) {
          // Pixabay provides direct download URLs
          const audioUrl = sound.previewURL; // Use preview for faster downloads
          
          if (audioUrl) {
            effects.push({
              id: `pixabay-${sound.id}`,
              url: audioUrl,
              duration: sound.duration || 2, // Pixabay doesn't always provide duration
              category,
              volumeLevel: 0.25, // Default to 25% volume
              name: sound.tags || `${category}-sound`,
              provider: 'pixabay',
            });
          }
        }
      }

      logger.info(`Found ${effects.length} sound effects for ${category}`);

      return {
        effects,
        totalFound: response.data.totalHits || 0,
      };
    } catch (error) {
      logger.error(`Failed to search Pixabay: ${error}`);
      throw new Error(`Pixabay search failed: ${error}`);
    }
  }

  /**
   * Download sound effect and cache it
   */
  async downloadSoundEffect(effect: SoundEffect): Promise<SoundEffectDownloadResult> {
    // Check if already cached
    const cachedPath = await this.getCachedSoundPath(effect.url);
    if (cachedPath) {
      logger.info(`Using cached sound effect: ${cachedPath}`);
      return { localPath: cachedPath, effect };
    }

    // Ensure cache directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Generate cache filename
    const urlHash = this.hashUrl(effect.url);
    const filename = `sfx-${effect.category}-${urlHash}.mp3`;
    const localPath = path.join(this.cacheDir, filename);

    try {
      logger.info(`Downloading sound effect from: ${effect.url}`);

      const response = await axios.get(effect.url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 60000, // 1 minute
      });

      await fs.writeFile(localPath, response.data);

      // Verify file was written successfully
      const stats = await fs.stat(localPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      logger.info(`Sound effect downloaded: ${localPath} (${stats.size} bytes)`);

      return { localPath, effect };
    } catch (error) {
      // Clean up failed download
      try {
        await fs.unlink(localPath);
      } catch {}

      logger.error(`Failed to download sound effect: ${error}`);
      throw new Error(`Sound effect download failed: ${error}`);
    }
  }

  /**
   * Calculate recommended volume level for sound effect
   * Target: 20-30% of main audio peak
   */
  calculateRecommendedVolume(
    mainAudioPeak: number,
    targetPercentage: number = 0.25
  ): number {
    // Ensure target is between 20-30%
    const clampedPercentage = Math.max(0.2, Math.min(0.3, targetPercentage));
    return mainAudioPeak * clampedPercentage;
  }

  /**
   * Validate that sound effect volume is within acceptable range
   */
  validateVolumeLevels(
    mainAudio: AudioTrack,
    sfxAudio: AudioTrack
  ): VolumeValidation {
    const recommendedSfxVolume = this.calculateRecommendedVolume(mainAudio.peakVolume);
    const minAcceptable = mainAudio.peakVolume * 0.2;
    const maxAcceptable = mainAudio.peakVolume * 0.3;

    const isValid = sfxAudio.peakVolume >= minAcceptable && sfxAudio.peakVolume <= maxAcceptable;

    return {
      isValid,
      mainAudioPeak: mainAudio.peakVolume,
      sfxPeak: sfxAudio.peakVolume,
      recommendedSfxVolume,
    };
  }

  /**
   * Get sound effect for a specific category with caching
   */
  async getSoundEffectForCategory(
    category: SoundEffectCategory,
    duration: number = 1.0
  ): Promise<SoundEffectDownloadResult> {
    try {
      // Search for sound effects
      const searchResult = await this.searchSoundEffect(category, duration, {
        maxResults: 10,
      });

      if (searchResult.effects.length === 0) {
        throw new Error(`No sound effects found for category: ${category}`);
      }

      // Get the first (highest rated) sound effect
      const effect = searchResult.effects[0];

      // Download and cache it
      return await this.downloadSoundEffect(effect);
    } catch (error) {
      logger.error(`Failed to get sound effect for ${category}: ${error}`);
      throw error;
    }
  }

  /**
   * Download multiple sound effects for different categories
   */
  async downloadMultipleSoundEffects(
    categories: SoundEffectCategory[]
  ): Promise<Map<SoundEffectCategory, SoundEffectDownloadResult>> {
    const results = new Map<SoundEffectCategory, SoundEffectDownloadResult>();

    for (const category of categories) {
      try {
        const result = await this.getSoundEffectForCategory(category);
        results.set(category, result);
        logger.info(`Downloaded sound effect for ${category}: ${result.localPath}`);
      } catch (error) {
        logger.warn(`Failed to download sound effect for ${category}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Check if sound effect is already cached
   */
  private async getCachedSoundPath(url: string): Promise<string | null> {
    const urlHash = this.hashUrl(url);
    
    // Check all possible category prefixes
    for (const category of Object.keys(this.categorySearchTerms)) {
      const filename = `sfx-${category}-${urlHash}.mp3`;
      const cachedPath = path.join(this.cacheDir, filename);

      try {
        const stats = await fs.stat(cachedPath);
        if (stats.size > 0) {
          return cachedPath;
        }
      } catch {
        // File doesn't exist, continue
      }
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
   * Clear cache for specific category or all
   */
  async clearCache(category?: SoundEffectCategory): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      
      for (const file of files) {
        if (category) {
          // Only delete files for specific category
          if (file.startsWith(`sfx-${category}-`)) {
            await fs.unlink(path.join(this.cacheDir, file));
            logger.info(`Deleted cached sound effect: ${file}`);
          }
        } else {
          // Delete all sound effect files
          if (file.startsWith('sfx-')) {
            await fs.unlink(path.join(this.cacheDir, file));
            logger.info(`Deleted cached sound effect: ${file}`);
          }
        }
      }

      logger.info(`Cache cleared for ${category || 'all categories'}`);
    } catch (error) {
      logger.error(`Failed to clear cache: ${error}`);
      throw error;
    }
  }
}

export default new SoundEffectsService();
