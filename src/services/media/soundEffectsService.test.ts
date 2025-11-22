import { describe, it, expect, vi, beforeEach } from 'vitest';
import soundEffectsService from './soundEffectsService';
import type { SoundEffectCategory, AudioTrack } from './soundEffectsService';

describe('SoundEffectsService', () => {
  describe('calculateRecommendedVolume', () => {
    it('should calculate 25% of main audio peak by default', () => {
      const mainAudioPeak = 1.0;
      const recommended = soundEffectsService.calculateRecommendedVolume(mainAudioPeak);
      expect(recommended).toBe(0.25);
    });

    it('should calculate custom percentage within 20-30% range', () => {
      const mainAudioPeak = 1.0;
      const recommended = soundEffectsService.calculateRecommendedVolume(mainAudioPeak, 0.28);
      expect(recommended).toBe(0.28);
    });

    it('should clamp percentage below 20% to 20%', () => {
      const mainAudioPeak = 1.0;
      const recommended = soundEffectsService.calculateRecommendedVolume(mainAudioPeak, 0.1);
      expect(recommended).toBe(0.2);
    });

    it('should clamp percentage above 30% to 30%', () => {
      const mainAudioPeak = 1.0;
      const recommended = soundEffectsService.calculateRecommendedVolume(mainAudioPeak, 0.5);
      expect(recommended).toBe(0.3);
    });
  });

  describe('validateVolumeLevels', () => {
    it('should validate volume within 20-30% range as valid', () => {
      const mainAudio: AudioTrack = {
        path: '/path/to/main.mp3',
        peakVolume: 1.0,
        averageVolume: 0.7,
      };

      const sfxAudio: AudioTrack = {
        path: '/path/to/sfx.mp3',
        peakVolume: 0.25,
        averageVolume: 0.2,
      };

      const validation = soundEffectsService.validateVolumeLevels(mainAudio, sfxAudio);

      expect(validation.isValid).toBe(true);
      expect(validation.mainAudioPeak).toBe(1.0);
      expect(validation.sfxPeak).toBe(0.25);
      expect(validation.recommendedSfxVolume).toBe(0.25);
    });

    it('should invalidate volume below 20%', () => {
      const mainAudio: AudioTrack = {
        path: '/path/to/main.mp3',
        peakVolume: 1.0,
        averageVolume: 0.7,
      };

      const sfxAudio: AudioTrack = {
        path: '/path/to/sfx.mp3',
        peakVolume: 0.15,
        averageVolume: 0.1,
      };

      const validation = soundEffectsService.validateVolumeLevels(mainAudio, sfxAudio);

      expect(validation.isValid).toBe(false);
      expect(validation.sfxPeak).toBe(0.15);
    });

    it('should invalidate volume above 30%', () => {
      const mainAudio: AudioTrack = {
        path: '/path/to/main.mp3',
        peakVolume: 1.0,
        averageVolume: 0.7,
      };

      const sfxAudio: AudioTrack = {
        path: '/path/to/sfx.mp3',
        peakVolume: 0.35,
        averageVolume: 0.3,
      };

      const validation = soundEffectsService.validateVolumeLevels(mainAudio, sfxAudio);

      expect(validation.isValid).toBe(false);
      expect(validation.sfxPeak).toBe(0.35);
    });

    it('should validate volume at exactly 20% as valid', () => {
      const mainAudio: AudioTrack = {
        path: '/path/to/main.mp3',
        peakVolume: 1.0,
        averageVolume: 0.7,
      };

      const sfxAudio: AudioTrack = {
        path: '/path/to/sfx.mp3',
        peakVolume: 0.2,
        averageVolume: 0.15,
      };

      const validation = soundEffectsService.validateVolumeLevels(mainAudio, sfxAudio);

      expect(validation.isValid).toBe(true);
    });

    it('should validate volume at exactly 30% as valid', () => {
      const mainAudio: AudioTrack = {
        path: '/path/to/main.mp3',
        peakVolume: 1.0,
        averageVolume: 0.7,
      };

      const sfxAudio: AudioTrack = {
        path: '/path/to/sfx.mp3',
        peakVolume: 0.3,
        averageVolume: 0.25,
      };

      const validation = soundEffectsService.validateVolumeLevels(mainAudio, sfxAudio);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('category search terms', () => {
    it('should have search terms for all categories', () => {
      const categories: SoundEffectCategory[] = ['whoosh', 'pop', 'transition', 'zoom', 'text-appear'];
      
      for (const category of categories) {
        // Access private property through type assertion for testing
        const service = soundEffectsService as any;
        const searchTerms = service.categorySearchTerms[category];
        
        expect(searchTerms).toBeDefined();
        expect(Array.isArray(searchTerms)).toBe(true);
        expect(searchTerms.length).toBeGreaterThan(0);
      }
    });
  });
});
