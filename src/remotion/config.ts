/**
 * Remotion Configuration
 *
 * Configuration for video rendering with Remotion
 * Includes Crown Mercado brand defaults
 */

import { CROWN_MERCADO_BRAND } from './brandConstants';

export const REMOTION_CONFIG = {
  // Video settings
  fps: 30,
  width: 1920,
  height: 1080,
  
  // Alternative aspect ratios
  aspectRatios: {
    landscape: { width: 1920, height: 1080 }, // 16:9
    portrait: { width: 1080, height: 1920 },  // 9:16
    square: { width: 1080, height: 1080 },    // 1:1
  },
  
  // Default duration (in frames)
  defaultDurationInFrames: 150, // 5 seconds at 30fps
  
  // Rendering settings
  rendering: {
    concurrency: 4,
    imageFormat: 'jpeg' as const,
    codec: 'h264' as const,
    quality: 80,
  },
  
  // Animation timing (using brand constants)
  timing: {
    fadeInDuration: CROWN_MERCADO_BRAND.timing.fadeIn,
    fadeOutDuration: CROWN_MERCADO_BRAND.timing.fadeOut,
    transitionDuration: CROWN_MERCADO_BRAND.timing.transition,
  },
  
  // Brand defaults
  brand: {
    defaultBackgroundColor: CROWN_MERCADO_BRAND.colors.charcoal,
    defaultAccentColor: CROWN_MERCADO_BRAND.colors.accentRed,
    defaultTextColor: CROWN_MERCADO_BRAND.colors.textPrimary,
    defaultFont: CROWN_MERCADO_BRAND.typography.headlineFont,
  }
} as const;

export type AspectRatio = keyof typeof REMOTION_CONFIG.aspectRatios;

/**
 * Get video dimensions for aspect ratio
 */
export function getVideoDimensions(aspectRatio: AspectRatio = 'landscape') {
  return REMOTION_CONFIG.aspectRatios[aspectRatio];
}

/**
 * Convert seconds to frames
 */
export function secondsToFrames(seconds: number, fps: number = REMOTION_CONFIG.fps): number {
  return Math.floor(seconds * fps);
}

/**
 * Convert frames to seconds
 */
export function framesToSeconds(frames: number, fps: number = REMOTION_CONFIG.fps): number {
  return frames / fps;
}
