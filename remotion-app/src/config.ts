import type {CompositionConfigOverrides} from './types';

/** The width of the video in pixels. */
export const VIDEO_WIDTH = 1920;
/** The height of the video in pixels. */
export const VIDEO_HEIGHT = 1080;
/** The frame rate of the video in frames per second. */
export const VIDEO_FPS = 30;

const fallbackDurationSeconds = 15 * 60; // 15 minutes default cap
/** The default duration of the composition in frames. */
export const DEFAULT_DURATION_IN_FRAMES = VIDEO_FPS * fallbackDurationSeconds;

/**
 * Default audio configuration settings.
 */
export const AUDIO = {
  /** Decibels to duck voice audio when other sounds play. */
  voiceDuckDb: -4,
  /** Base gain in decibels for sound effects. */
  sfxBaseGainDb: -10,
};

/**
 * Default transition configuration settings.
 */
export const TRANSITIONS = {
  /** Minimum silence duration in milliseconds required before a transition is inserted. */
  minPauseMs: 700,
  /** Default fade duration in seconds. */
  defaultFade: 0.8,
};

/**
 * Brand-related configuration, including colors, gradients, and fonts.
 */
export const BRAND = {
  primary: '#C8102E',
  red: '#C8102E',
  secondary: '#1C1C1C',
  charcoal: '#1C1C1C',
  black: '#1C1C1C',
  white: '#FFFFFF',
  lightGray: '#F2F2F2',
  gradient: 'linear-gradient(135deg, rgba(200,16,46,0.95) 0%, rgba(28,28,28,0.98) 60%, rgba(12,12,12,1) 100%)',
  radialGlow: 'radial-gradient(circle at 20% 20%, rgba(200,16,46,0.25), transparent 65%)',
  fonts: {
    heading: "'Montserrat Black', 'Montserrat ExtraBold', 'Montserrat', 'Helvetica Neue', 'Inter', sans-serif",
    heavy: "'Montserrat Black', 'Montserrat ExtraBold', 'Montserrat', sans-serif",
    body: "'Montserrat', 'Open Sans', 'Helvetica Neue', 'Inter', sans-serif",
  },
  overlays: {
    glassBackground: 'rgba(200,16,46,0.48)',
    glassBorder: 'rgba(255,255,255,0.22)',
    accentGradient: 'linear-gradient(135deg, rgba(200,16,46,0.9) 0%, rgba(98,11,24,0.9) 100%)',
    triangle: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(200,16,46,0.6) 100%)',
  },
};

/**
 * Represents the resolved runtime configuration for the composition.
 */
export interface RuntimeConfig {
  audio: typeof AUDIO;
  transitions: typeof TRANSITIONS;
  brand: typeof BRAND;
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param value The number to clamp.
 * @param min The minimum allowed value.
 * @param max The maximum allowed value.
 * @returns The clamped number.
 */
const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Normalizes an input value to a number, applying a fallback and optional min/max clamping.
 * @param input The input value to normalize.
 * @param fallback The default value to use if the input is not a valid number.
 * @param options Optional object with min and max properties for clamping.
 * @returns The normalized and clamped number.
 */
const normalizeNumber = (input: unknown, fallback: number, {min, max}: {min?: number; max?: number} = {}) => {
  const numeric = Number(input);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  if (typeof min === 'number' || typeof max === 'number') {
    return clampNumber(
      numeric,
      typeof min === 'number' ? min : numeric, // If min is not defined, use numeric itself
      typeof max === 'number' ? max : numeric  // If max is not defined, use numeric itself
    );
  }
  return numeric;
};

/**
 * Resolves the final runtime configuration by merging default settings with provided overrides.
 * Applies normalization and clamping to ensure valid numeric values.
 * @param overrides Optional configuration overrides.
 * @returns The resolved RuntimeConfig object.
 */
export const resolveRuntimeConfig = (
  overrides: CompositionConfigOverrides | undefined | null
): RuntimeConfig => {
  // Merge audio settings and normalize numeric values
  const audio = {
    ...AUDIO,
    ...(overrides?.audio ?? {}),
  } as typeof AUDIO;

  audio.voiceDuckDb = normalizeNumber(audio.voiceDuckDb, AUDIO.voiceDuckDb, {min: -24, max: 0});
  audio.sfxBaseGainDb = normalizeNumber(audio.sfxBaseGainDb, AUDIO.sfxBaseGainDb, {min: -36, max: -1});

  // Merge transition settings and normalize numeric values
  const transitions = {
    ...TRANSITIONS,
    ...(overrides?.transitions ?? {}),
  } as typeof TRANSITIONS;

  // Handle explicit minPauseMs override separately for clamping
  const explicitMinPause = overrides?.minPauseMs;
  if (typeof explicitMinPause === 'number' && !Number.isNaN(explicitMinPause)) {
    transitions.minPauseMs = clampNumber(explicitMinPause, 0, 4000);
  } else {
    transitions.minPauseMs = normalizeNumber(transitions.minPauseMs, TRANSITIONS.minPauseMs, {
      min: 0,
      max: 4000,
    });
  }

  transitions.defaultFade = normalizeNumber(transitions.defaultFade, TRANSITIONS.defaultFade, {
    min: 0.3,
    max: 2.4,
  });

  // Merge brand settings
  const brand = {
    ...BRAND,
    ...(overrides?.brand ?? {}),
  } as typeof BRAND;

  return {
    audio,
    transitions,
    brand,
  };
};
