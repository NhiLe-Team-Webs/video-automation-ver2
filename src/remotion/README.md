# Remotion Rendering Infrastructure

This directory contains the Remotion rendering infrastructure for the YouTube Video Automation system.

## Structure

```
src/remotion/
├── templates/          # Animation templates (copied from reference)
│   ├── animated-text.tsx
│   ├── bounce-text.tsx
│   ├── slide-text.tsx
│   ├── typewriter-subtitle.tsx
│   ├── pulsing-text.tsx
│   ├── card-flip.tsx
│   └── index.ts
├── animations/         # CSS animations reference
│   └── css-animations.ts
├── transitions/        # Transition effects
│   └── index.ts
├── config.ts          # Remotion configuration
├── templateLoader.ts  # Template loading system
└── index.ts          # Main entry point
```

## Usage

### 1. Import Templates

```typescript
import { AnimatedText, BounceText } from './remotion/templates';
```

### 2. Get Available Resources for LLM

```typescript
import { generateResourceListForLLM } from './remotion';

const resourceList = generateResourceListForLLM();
// Use this in LLM prompt to inform it about available templates
```

### 3. Load Template Dynamically

```typescript
import { TemplateLoader } from './remotion/templateLoader';

const templateInfo = TemplateLoader.getTemplateInfo('animated-text');
const component = TemplateLoader.getTemplateComponent('animated-text');
```

### 4. Use CSS Animations

```typescript
import 'animate.css';
import { getAnimationClassName } from './remotion/animations/css-animations';

const className = getAnimationClassName('fadeIn');
// Returns: 'animate__animated animate__fadeIn'
```

### 5. Use Transitions

```typescript
import { TransitionSeries } from 'remotion-transition-series';
import { getTransitionInfo } from './remotion/transitions';

const transitionInfo = getTransitionInfo('fade');
```

## Configuration

Video rendering settings are defined in `config.ts`:

- **FPS**: 30
- **Resolution**: 1920x1080 (landscape)
- **Aspect Ratios**: landscape (16:9), portrait (9:16), square (1:1)
- **Codec**: h264
- **Quality**: 80

## Templates

All templates are React components that accept props for customization:

- **AnimatedText**: Character-by-character animation
- **BounceText**: Bouncing text with background
- **SlideText**: Sliding text from sides
- **TypewriterSubtitle**: Typewriter effect
- **PulsingText**: Pulsing animation
- **CardFlip**: 3D card flip

## CSS Animations

Over 70 CSS animations from Animate.css are available:

- Attention seekers (bounce, flash, pulse, etc.)
- Entrances (fadeIn, slideIn, zoomIn, etc.)
- Exits (fadeOut, slideOut, zoomOut, etc.)
- Flippers, rotations, and more

## Transitions

Transitions from remotion-transition-series:

- Fade
- Dissolve
- Slide
- Wipe
- Circular Wipe
- Sliding Doors
- Pan

## Integration with LLM

The `generateResourceListForLLM()` function creates a formatted list of all available resources. This should be included in the LLM prompt when generating editing plans, so the LLM knows which templates, animations, and transitions are available.

## Next Steps

- Task 11 will implement the preview service
- Task 12 will implement the rendering service that uses these templates
