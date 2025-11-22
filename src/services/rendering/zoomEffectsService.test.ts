import { describe, it, expect, beforeEach } from 'vitest';
import { ZoomEffectsService, ZoomConfig } from './zoomEffectsService';
import { ZoomEffect } from '../content-analysis/editingPlanService';

describe('ZoomEffectsService', () => {
  describe('createZoomEffect', () => {
    it('should create zoom effect with default parameters', () => {
      const config: ZoomConfig = {
        startTime: 5.0,
        endTime: 8.0,
      };

      const effect = ZoomEffectsService.createZoomEffect(config);

      expect(effect.startTime).toBe(5.0);
      expect(effect.endTime).toBe(8.0);
      expect(effect.targetScale).toBe(1.2); // Default 120%
      expect(effect.easingFunction).toBe('ease-in-out'); // Default
      expect(effect.zoomDuration).toBe(400); // Default 400ms
      expect(effect.id).toMatch(/^zoom-/);
    });

    it('should create zoom effect with custom parameters', () => {
      const config: ZoomConfig = {
        startTime: 10.0,
        endTime: 15.0,
        targetScale: 1.5,
        easingFunction: 'ease-in',
        zoomDuration: 500,
      };

      const effect = ZoomEffectsService.createZoomEffect(config);

      expect(effect.startTime).toBe(10.0);
      expect(effect.endTime).toBe(15.0);
      expect(effect.targetScale).toBe(1.5);
      expect(effect.easingFunction).toBe('ease-in');
      expect(effect.zoomDuration).toBe(500);
    });

    it('should generate unique IDs for each zoom effect', () => {
      const config: ZoomConfig = {
        startTime: 0,
        endTime: 1,
      };

      const effect1 = ZoomEffectsService.createZoomEffect(config);
      const effect2 = ZoomEffectsService.createZoomEffect(config);

      expect(effect1.id).not.toBe(effect2.id);
    });
  });

  describe('createZoomEffectsForHighlights', () => {
    it('should create zoom effects for all highlights', () => {
      const highlights = [
        { startTime: 5.0, endTime: 8.0 },
        { startTime: 15.0, endTime: 18.0 },
        { startTime: 25.0, endTime: 28.0 },
      ];

      const zoomEffects = ZoomEffectsService.createZoomEffectsForHighlights(highlights);

      expect(zoomEffects).toHaveLength(3);
      expect(zoomEffects[0].startTime).toBe(5.0);
      expect(zoomEffects[0].endTime).toBe(8.0);
      expect(zoomEffects[1].startTime).toBe(15.0);
      expect(zoomEffects[2].startTime).toBe(25.0);
    });

    it('should create zoom effects with default parameters', () => {
      const highlights = [{ startTime: 5.0, endTime: 8.0 }];

      const zoomEffects = ZoomEffectsService.createZoomEffectsForHighlights(highlights);

      expect(zoomEffects[0].targetScale).toBe(1.2);
      expect(zoomEffects[0].easingFunction).toBe('ease-in-out');
      expect(zoomEffects[0].zoomDuration).toBe(400);
    });

    it('should handle empty highlights array', () => {
      const highlights: Array<{ startTime: number; endTime: number }> = [];

      const zoomEffects = ZoomEffectsService.createZoomEffectsForHighlights(highlights);

      expect(zoomEffects).toHaveLength(0);
    });
  });

  describe('validateZoomTiming', () => {
    it('should validate non-overlapping zoom effects', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 8.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-2',
          startTime: 10.0,
          endTime: 13.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      const result = ZoomEffectsService.validateZoomTiming(effects);

      expect(result.isValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect overlapping zoom effects', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 10.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-2',
          startTime: 8.0,
          endTime: 12.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      const result = ZoomEffectsService.validateZoomTiming(effects);

      expect(result.isValid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].effect1).toBe('zoom-1');
      expect(result.conflicts[0].effect2).toBe('zoom-2');
      expect(result.conflicts[0].overlapDuration).toBe(2.0); // 10.0 - 8.0
    });

    it('should detect multiple overlaps', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 10.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-2',
          startTime: 8.0,
          endTime: 12.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-3',
          startTime: 9.0,
          endTime: 14.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      const result = ZoomEffectsService.validateZoomTiming(effects);

      expect(result.isValid).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(1);
    });

    it('should handle empty effects array', () => {
      const effects: ZoomEffect[] = [];

      const result = ZoomEffectsService.validateZoomTiming(effects);

      expect(result.isValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('resolveOverlaps', () => {
    it('should resolve overlapping zoom effects by adjusting timing', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 10.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-2',
          startTime: 8.0,
          endTime: 13.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      const resolved = ZoomEffectsService.resolveOverlaps(effects);

      // Second effect should be moved to start after first effect ends
      expect(resolved[0].startTime).toBe(5.0);
      expect(resolved[0].endTime).toBe(10.0);
      expect(resolved[1].startTime).toBeGreaterThan(10.0);
      expect(resolved[1].endTime - resolved[1].startTime).toBe(5.0); // Duration preserved
    });

    it('should maintain effect duration when resolving overlaps', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 8.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-2',
          startTime: 7.0,
          endTime: 12.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      const originalDuration = effects[1].endTime - effects[1].startTime;
      const resolved = ZoomEffectsService.resolveOverlaps(effects);
      const newDuration = resolved[1].endTime - resolved[1].startTime;

      expect(newDuration).toBeCloseTo(originalDuration, 5);
    });

    it('should handle multiple overlapping effects', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 10.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-2',
          startTime: 8.0,
          endTime: 12.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-3',
          startTime: 9.0,
          endTime: 14.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      const resolved = ZoomEffectsService.resolveOverlaps(effects);

      // All effects should be non-overlapping
      for (let i = 0; i < resolved.length - 1; i++) {
        expect(resolved[i].endTime).toBeLessThanOrEqual(resolved[i + 1].startTime);
      }
    });

    it('should not modify non-overlapping effects', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 8.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-2',
          startTime: 10.0,
          endTime: 13.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      const resolved = ZoomEffectsService.resolveOverlaps(effects);

      expect(resolved[0].startTime).toBe(5.0);
      expect(resolved[0].endTime).toBe(8.0);
      expect(resolved[1].startTime).toBe(10.0);
      expect(resolved[1].endTime).toBe(13.0);
    });

    it('should handle empty effects array', () => {
      const effects: ZoomEffect[] = [];

      const resolved = ZoomEffectsService.resolveOverlaps(effects);

      expect(resolved).toHaveLength(0);
    });
  });

  describe('validateZoomEffect', () => {
    it('should validate correct zoom effect', () => {
      const effect: ZoomEffect = {
        id: 'zoom-1',
        startTime: 5.0,
        endTime: 8.0,
        targetScale: 1.2,
        easingFunction: 'ease-in-out',
        zoomDuration: 400,
      };

      const result = ZoomEffectsService.validateZoomEffect(effect);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative start time', () => {
      const effect: ZoomEffect = {
        id: 'zoom-1',
        startTime: -1.0,
        endTime: 8.0,
        targetScale: 1.2,
        easingFunction: 'ease-in-out',
        zoomDuration: 400,
      };

      const result = ZoomEffectsService.validateZoomEffect(effect);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('negative');
    });

    it('should reject end time before start time', () => {
      const effect: ZoomEffect = {
        id: 'zoom-1',
        startTime: 10.0,
        endTime: 5.0,
        targetScale: 1.2,
        easingFunction: 'ease-in-out',
        zoomDuration: 400,
      };

      const result = ZoomEffectsService.validateZoomEffect(effect);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('greater than start time'))).toBe(true);
    });

    it('should reject negative or zero target scale', () => {
      const effect: ZoomEffect = {
        id: 'zoom-1',
        startTime: 5.0,
        endTime: 8.0,
        targetScale: 0,
        easingFunction: 'ease-in-out',
        zoomDuration: 400,
      };

      const result = ZoomEffectsService.validateZoomEffect(effect);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('positive'))).toBe(true);
    });

    it('should reject invalid easing function', () => {
      const effect: ZoomEffect = {
        id: 'zoom-1',
        startTime: 5.0,
        endTime: 8.0,
        targetScale: 1.2,
        easingFunction: 'invalid' as any,
        zoomDuration: 400,
      };

      const result = ZoomEffectsService.validateZoomEffect(effect);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid easing function'))).toBe(true);
    });

    it('should reject zoom duration exceeding effect duration', () => {
      const effect: ZoomEffect = {
        id: 'zoom-1',
        startTime: 5.0,
        endTime: 5.5, // 500ms effect duration
        targetScale: 1.2,
        easingFunction: 'ease-in-out',
        zoomDuration: 400, // 400ms × 2 = 800ms > 500ms
      };

      const result = ZoomEffectsService.validateZoomEffect(effect);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds effect duration'))).toBe(true);
    });
  });

  describe('getZoomScaleAtTime', () => {
    it('should return 1.0 when no zoom effect is active', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 8.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      const scale = ZoomEffectsService.getZoomScaleAtTime(3.0, effects);

      expect(scale).toBe(1.0);
    });

    it('should return target scale during hold phase', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 8.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      // Middle of effect (hold phase)
      const scale = ZoomEffectsService.getZoomScaleAtTime(6.5, effects);

      expect(scale).toBe(1.2);
    });

    it('should interpolate during zoom in phase', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 8.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      // Start of zoom in
      const scaleStart = ZoomEffectsService.getZoomScaleAtTime(5.0, effects);
      expect(scaleStart).toBe(1.0);

      // Middle of zoom in
      const scaleMid = ZoomEffectsService.getZoomScaleAtTime(5.2, effects);
      expect(scaleMid).toBeGreaterThan(1.0);
      expect(scaleMid).toBeLessThan(1.2);

      // End of zoom in
      const scaleEnd = ZoomEffectsService.getZoomScaleAtTime(5.4, effects);
      expect(scaleEnd).toBe(1.2);
    });

    it('should interpolate during zoom out phase', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 8.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      // Start of zoom out (0.4s before end)
      const scaleStart = ZoomEffectsService.getZoomScaleAtTime(7.6, effects);
      expect(scaleStart).toBe(1.2);

      // Middle of zoom out
      const scaleMid = ZoomEffectsService.getZoomScaleAtTime(7.8, effects);
      expect(scaleMid).toBeGreaterThan(1.0);
      expect(scaleMid).toBeLessThan(1.2);

      // End of zoom out
      const scaleEnd = ZoomEffectsService.getZoomScaleAtTime(8.0, effects);
      expect(scaleEnd).toBe(1.0);
    });

    it('should handle multiple zoom effects correctly', () => {
      const effects: ZoomEffect[] = [
        {
          id: 'zoom-1',
          startTime: 5.0,
          endTime: 8.0,
          targetScale: 1.2,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
        {
          id: 'zoom-2',
          startTime: 10.0,
          endTime: 13.0,
          targetScale: 1.3,
          easingFunction: 'ease-in-out',
          zoomDuration: 400,
        },
      ];

      // First effect
      const scale1 = ZoomEffectsService.getZoomScaleAtTime(6.5, effects);
      expect(scale1).toBe(1.2);

      // Between effects
      const scale2 = ZoomEffectsService.getZoomScaleAtTime(9.0, effects);
      expect(scale2).toBe(1.0);

      // Second effect
      const scale3 = ZoomEffectsService.getZoomScaleAtTime(11.5, effects);
      expect(scale3).toBe(1.3);
    });
  });
});
