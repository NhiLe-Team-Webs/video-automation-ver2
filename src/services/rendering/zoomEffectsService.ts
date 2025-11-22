import { ZoomEffect } from '../content-analysis/editingPlanService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ZoomEffectsService');

export interface ZoomConfig {
  startTime: number;
  endTime: number;
  targetScale?: number; // Default: 1.2 (120%)
  easingFunction?: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear'; // Default: ease-in-out
  zoomDuration?: number; // Default: 400ms
}

export interface ZoomConflict {
  effect1: string;
  effect2: string;
  overlapDuration: number;
  resolution: 'merge' | 'remove-second' | 'adjust-timing';
}

export interface ValidationResult {
  isValid: boolean;
  conflicts: ZoomConflict[];
}

/**
 * Zoom Effects Service
 * 
 * Creates and manages zoom effects for video highlighting
 * Implements Requirements 15.1-15.5 for dynamic zoom effects
 */
export class ZoomEffectsService {
  private static idCounter = 0;

  /**
   * Create a zoom effect with default parameters
   * Default: scale 1.0 → 1.2 → 1.0, 400ms duration, ease-in-out
   */
  static createZoomEffect(config: ZoomConfig): ZoomEffect {
    const id = `zoom-${Date.now()}-${this.idCounter++}`;

    return {
      id,
      startTime: config.startTime,
      endTime: config.endTime,
      targetScale: config.targetScale ?? 1.2, // Default 120% zoom
      easingFunction: config.easingFunction ?? 'ease-in-out',
      zoomDuration: config.zoomDuration ?? 400, // Default 400ms
    };
  }

  /**
   * Create zoom effects for all highlights
   * Each highlight gets a zoom effect at its start/end timestamps
   */
  static createZoomEffectsForHighlights(
    highlights: Array<{ startTime: number; endTime: number }>
  ): ZoomEffect[] {
    logger.info('Creating zoom effects for highlights', {
      highlightCount: highlights.length,
    });

    const zoomEffects = highlights.map((highlight) =>
      this.createZoomEffect({
        startTime: highlight.startTime,
        endTime: highlight.endTime,
      })
    );

    logger.info('Zoom effects created', {
      zoomEffectCount: zoomEffects.length,
    });

    return zoomEffects;
  }

  /**
   * Validate zoom effect timing
   * Checks for overlaps and conflicts
   */
  static validateZoomTiming(effects: ZoomEffect[]): ValidationResult {
    const conflicts: ZoomConflict[] = [];

    for (let i = 0; i < effects.length; i++) {
      for (let j = i + 1; j < effects.length; j++) {
        const effect1 = effects[i];
        const effect2 = effects[j];

        // Check if time ranges overlap
        const overlap = this.calculateOverlap(
          effect1.startTime,
          effect1.endTime,
          effect2.startTime,
          effect2.endTime
        );

        if (overlap > 0) {
          conflicts.push({
            effect1: effect1.id,
            effect2: effect2.id,
            overlapDuration: overlap,
            resolution: 'adjust-timing',
          });
        }
      }
    }

    const isValid = conflicts.length === 0;

    if (!isValid) {
      logger.warn('Zoom effect validation found conflicts', {
        conflictCount: conflicts.length,
        conflicts,
      });
    }

    return {
      isValid,
      conflicts,
    };
  }

  /**
   * Calculate overlap between two time ranges
   */
  private static calculateOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): number {
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);
    return Math.max(0, overlapEnd - overlapStart);
  }

  /**
   * Resolve overlapping zoom effects by adjusting timing
   * Strategy: Move later effects to start after earlier ones complete
   */
  static resolveOverlaps(effects: ZoomEffect[]): ZoomEffect[] {
    if (effects.length === 0) {
      return effects;
    }

    logger.info('Resolving zoom effect overlaps', {
      effectCount: effects.length,
    });

    // Sort by start time
    const sorted = [...effects].sort((a, b) => a.startTime - b.startTime);

    // Adjust overlapping effects
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // If current overlaps with next, adjust next's start time
      if (current.endTime > next.startTime) {
        const gap = 0.1; // 100ms gap between zoom effects
        const duration = next.endTime - next.startTime;
        const newStartTime = current.endTime + gap;

        logger.info('Adjusting overlapping zoom effect', {
          currentId: current.id,
          nextId: next.id,
          originalStart: next.startTime,
          newStart: newStartTime,
          overlap: current.endTime - next.startTime,
        });

        next.startTime = newStartTime;
        next.endTime = newStartTime + duration;
      }
    }

    logger.info('Zoom effect overlaps resolved', {
      effectCount: sorted.length,
    });

    return sorted;
  }

  /**
   * Validate zoom effect parameters
   */
  static validateZoomEffect(effect: ZoomEffect): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (effect.startTime < 0) {
      errors.push(`Start time cannot be negative: ${effect.startTime}`);
    }

    if (effect.endTime <= effect.startTime) {
      errors.push(
        `End time (${effect.endTime}) must be greater than start time (${effect.startTime})`
      );
    }

    if (effect.targetScale <= 0) {
      errors.push(`Target scale must be positive: ${effect.targetScale}`);
    }

    if (effect.zoomDuration <= 0) {
      errors.push(`Zoom duration must be positive: ${effect.zoomDuration}ms`);
    }

    const validEasings = ['ease-in-out', 'ease-in', 'ease-out', 'linear'];
    if (!validEasings.includes(effect.easingFunction)) {
      errors.push(`Invalid easing function: ${effect.easingFunction}`);
    }

    // Check if zoom duration is reasonable for the effect duration
    const effectDurationMs = (effect.endTime - effect.startTime) * 1000;
    const totalZoomDuration = effect.zoomDuration * 2; // zoom in + zoom out

    if (totalZoomDuration > effectDurationMs) {
      errors.push(
        `Zoom duration (${effect.zoomDuration}ms × 2) exceeds effect duration (${effectDurationMs}ms)`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get zoom scale at a specific time
   * Useful for testing and validation
   */
  static getZoomScaleAtTime(time: number, effects: ZoomEffect[]): number {
    const activeEffect = effects.find(
      (effect) => time >= effect.startTime && time <= effect.endTime
    );

    if (!activeEffect) {
      return 1.0;
    }

    const zoomDurationSeconds = activeEffect.zoomDuration / 1000;
    const timeInEffect = time - activeEffect.startTime;

    // Zoom in phase
    if (timeInEffect <= zoomDurationSeconds) {
      const progress = timeInEffect / zoomDurationSeconds;
      return this.interpolate(progress, 1.0, activeEffect.targetScale);
    }

    // Hold phase
    const zoomOutStartTime = activeEffect.endTime - zoomDurationSeconds;
    if (time < zoomOutStartTime) {
      return activeEffect.targetScale;
    }

    // Zoom out phase
    const timeInZoomOut = time - zoomOutStartTime;
    const progress = timeInZoomOut / zoomDurationSeconds;
    return this.interpolate(progress, activeEffect.targetScale, 1.0);
  }

  /**
   * Simple linear interpolation
   */
  private static interpolate(progress: number, start: number, end: number): number {
    return start + (end - start) * Math.max(0, Math.min(1, progress));
  }
}

export default ZoomEffectsService;
