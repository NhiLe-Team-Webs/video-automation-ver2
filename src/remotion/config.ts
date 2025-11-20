/**
 * Remotion Configuration
 * 
 * Configuration for video rendering with Remotion
 */

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
  
  // Animation timing
  timing: {
    fadeInDuration: 15,  // 0.5 seconds
    fadeOutDuration: 15, // 0.5 seconds
    transitionDuration: 30, // 1 second
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
