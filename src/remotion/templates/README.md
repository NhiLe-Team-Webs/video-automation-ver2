# Remotion Animation Templates

This directory contains reusable animation templates copied from the reference implementation.

## Available Templates (15 total)

### Text Animations (8)
- `animated-text.tsx` - Character-by-character animated text with spring physics
- `bounce-text.tsx` - Bouncing text animation with background box
- `pulsing-text.tsx` - Pulsing text animation with glow effect
- `slide-text.tsx` - Sliding text animation from sides
- `typewriter-subtitle.tsx` - Typewriter effect for subtitles with blinking cursor
- `bubble-pop-text.tsx` - Text with bubble pop animation effect
- `floating-bubble-text.tsx` - Text with floating bubble effect
- `glitch-text.tsx` - Text with glitch/distortion effect

### Visual Effects (7)
- `card-flip.tsx` - 3D card flip animation
- `animated-list.tsx` - List items with slide and fade animation
- `geometric-patterns.tsx` - Animated geometric patterns background
- `liquid-wave.tsx` - Animated liquid wave effect
- `matrix-rain.tsx` - Matrix-style falling characters effect
- `particle-explosion.tsx` - Particle explosion animation effect
- `sound-wave.tsx` - Animated sound wave visualization

## Usage

These templates are React components that use Remotion's hooks and utilities.
They can be imported and used in video compositions.

Example:
```tsx
import { AnimatedText } from './templates/animated-text';

<Composition
  id="MyVideo"
  component={AnimatedText}
  durationInFrames={150}
  fps={30}
  width={1920}
  height={1080}
/>
```

## CSS Animations

CSS animations from Animate.css are available via:
```tsx
import 'animate.css';
```

## Transitions

Transitions from remotion-transition-series are available:
```tsx
import { TransitionSeries } from 'remotion-transition-series';
```
