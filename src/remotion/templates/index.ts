/**
 * Remotion Animation Templates
 * 
 * Export all available animation templates
 */

// Text animations
export { AnimatedText } from './animated-text';
export { BounceText } from './bounce-text';
export { SlideText } from './slide-text';
export { TypewriterSubtitle } from './typewriter-subtitle';
export { PulsingText } from './pulsing-text';
export { BubblePopText } from './bubble-pop-text';
export { FloatingBubbleText } from './floating-bubble-text';
export { GlitchText } from './glitch-text';

// Visual effects
export { CardFlip } from './card-flip';
export { AnimatedList } from './animated-list';
export { GeometricPatterns } from './geometric-patterns';
export { LiquidWave } from './liquid-wave';
export { MatrixRain } from './matrix-rain';
export { ParticleExplosion } from './particle-explosion';
export { SoundWave } from './sound-wave';

// Template metadata for LLM to reference
export const AVAILABLE_TEMPLATES = {
  'animated-text': {
    name: 'AnimatedText',
    description: 'Character-by-character animated text with spring physics',
    category: 'text',
    parameters: ['text', 'fontSize', 'color']
  },
  'bounce-text': {
    name: 'BounceText',
    description: 'Bouncing text animation with slide and scale effects',
    category: 'text',
    parameters: ['title', 'subtitle', 'backgroundColor']
  },
  'slide-text': {
    name: 'SlideText',
    description: 'Text sliding in from the side with fade effect',
    category: 'text',
    parameters: ['text', 'fontSize', 'color', 'direction']
  },
  'typewriter-subtitle': {
    name: 'TypewriterSubtitle',
    description: 'Typewriter effect for subtitles with blinking cursor',
    category: 'subtitle',
    parameters: ['text', 'fontSize', 'color', 'durationInFrames']
  },
  'pulsing-text': {
    name: 'PulsingText',
    description: 'Text with pulsing animation effect',
    category: 'text',
    parameters: ['text', 'fontSize', 'color']
  },
  'bubble-pop-text': {
    name: 'BubblePopText',
    description: 'Text with bubble pop animation effect',
    category: 'text',
    parameters: ['text']
  },
  'floating-bubble-text': {
    name: 'FloatingBubbleText',
    description: 'Text with floating bubble effect',
    category: 'text',
    parameters: ['text']
  },
  'glitch-text': {
    name: 'GlitchText',
    description: 'Text with glitch/distortion effect',
    category: 'text',
    parameters: ['text', 'fontSize']
  },
  'card-flip': {
    name: 'CardFlip',
    description: '3D card flip animation',
    category: 'effect',
    parameters: ['frontText', 'backText', 'backgroundColor']
  },
  'animated-list': {
    name: 'AnimatedList',
    description: 'List items with slide and fade animation',
    category: 'effect',
    parameters: ['items']
  },
  'geometric-patterns': {
    name: 'GeometricPatterns',
    description: 'Animated geometric patterns background',
    category: 'effect',
    parameters: ['patternCount']
  },
  'liquid-wave': {
    name: 'LiquidWave',
    description: 'Animated liquid wave effect',
    category: 'effect',
    parameters: ['numberOfPoints', 'waveColor']
  },
  'matrix-rain': {
    name: 'MatrixRain',
    description: 'Matrix-style falling characters effect',
    category: 'effect',
    parameters: []
  },
  'particle-explosion': {
    name: 'ParticleExplosion',
    description: 'Particle explosion animation effect',
    category: 'effect',
    parameters: ['text', 'particleCount']
  },
  'sound-wave': {
    name: 'SoundWave',
    description: 'Animated sound wave visualization',
    category: 'effect',
    parameters: ['barCount']
  }
} as const;

export type TemplateName = keyof typeof AVAILABLE_TEMPLATES;
