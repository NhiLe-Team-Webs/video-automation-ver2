# Remotion Setup Guide

This document explains the Remotion rendering infrastructure setup for the YouTube Video Automation system.

## Overview

Task 10 sets up the Remotion rendering infrastructure by:
1. Installing Remotion and related dependencies
2. Creating a template library from reference implementations
3. Setting up template loader system
4. Configuring CSS animations and transitions

## Installed Dependencies

### Core Remotion Packages
```bash
npm install remotion @remotion/cli @remotion/bundler @remotion/renderer react react-dom
```

- `remotion`: Core Remotion framework
- `@remotion/cli`: CLI tools for Remotion
- `@remotion/bundler`: Bundler for Remotion projects
- `@remotion/renderer`: Server-side rendering
- `react` & `react-dom`: Required peer dependencies

### Animation Libraries
```bash
npm install animate.css remotion-transition-series
```

- `animate.css`: CSS animation library (70+ animations)
- `remotion-transition-series`: Transition components for Remotion

### TypeScript Types
```bash
npm install --save-dev @types/react @types/react-dom
```

## Directory Structure

```
src/remotion/
├── templates/              # Animation templates
│   ├── animated-text.tsx   # Character animation
│   ├── bounce-text.tsx     # Bouncing text
│   ├── slide-text.tsx      # Sliding text
│   ├── typewriter-subtitle.tsx  # Typewriter effect
│   ├── pulsing-text.tsx    # Pulsing animation
│   ├── card-flip.tsx       # 3D card flip
│   ├── index.ts            # Template exports
│   └── README.md           # Template documentation
├── animations/
│   └── css-animations.ts   # CSS animation reference
├── transitions/
│   └── index.ts            # Transition reference
├── config.ts               # Remotion configuration
├── templateLoader.ts       # Template loading system
├── index.ts                # Main entry point
├── example-usage.ts        # Usage examples
└── README.md               # Module documentation
```

## Available Resources

### Animation Templates (6)
1. **AnimatedText**: Character-by-character animation with spring physics
2. **BounceText**: Bouncing text with background
3. **SlideText**: Text sliding from sides
4. **TypewriterSubtitle**: Typewriter effect with cursor
5. **PulsingText**: Pulsing animation effect
6. **CardFlip**: 3D card flip animation

### CSS Animations (70+)
- Attention seekers: bounce, flash, pulse, shake, etc.
- Entrances: fadeIn, slideIn, zoomIn, bounceIn, etc.
- Exits: fadeOut, slideOut, zoomOut, bounceOut, etc.
- Rotations, flips, and special effects

### Transitions (7)
- Fade
- Dissolve
- Slide
- Wipe
- Circular Wipe
- Sliding Doors
- Pan

## Configuration

Default video settings (in `src/remotion/config.ts`):

```typescript
{
  fps: 30,
  width: 1920,
  height: 1080,
  aspectRatios: {
    landscape: { width: 1920, height: 1080 }, // 16:9
    portrait: { width: 1080, height: 1920 },  // 9:16
    square: { width: 1080, height: 1080 },    // 1:1
  }
}
```

## Usage Examples

### 1. Get Available Templates

```typescript
import { TemplateLoader } from './remotion/templateLoader';

const templates = TemplateLoader.getAvailableTemplates();
// ['animated-text', 'bounce-text', 'slide-text', ...]
```

### 2. Load Template Info

```typescript
const info = TemplateLoader.getTemplateInfo('animated-text');
// {
//   name: 'AnimatedText',
//   description: 'Character-by-character animated text...',
//   category: 'text',
//   parameters: ['text', 'fontSize', 'color']
// }
```

### 3. Generate Resource List for LLM

```typescript
import { generateResourceListForLLM } from './remotion';

const resourceList = generateResourceListForLLM();
// Returns formatted string with all available templates, animations, and transitions
// This will be used in Task 8 when generating editing plans
```

### 4. Use in Editing Plan (Task 8)

```typescript
// In LLM service (Task 8)
const prompt = `
Generate a video editing plan using these resources:

${generateResourceListForLLM()}

Video transcript: ${transcript}
Highlights: ${highlights}

Create an editing plan with appropriate animations and transitions.
`;
```

## Integration Points

### Task 8: LLM Editing Plan Service
- Use `generateResourceListForLLM()` to inform LLM about available resources
- LLM will reference template names in editing plans
- Validate template existence using `TemplateLoader.templateExists()`

### Task 11: Preview Service
- Use templates to generate preview videos
- Load components dynamically with `TemplateLoader.getTemplateComponent()`

### Task 12: Rendering Service
- Use templates to render final videos
- Apply animations and transitions based on editing plan
- Configure video settings from `config.ts`

## Testing

Run template loader tests:

```bash
npm test src/remotion/templateLoader.test.ts
```

Run example usage:

```bash
npx tsx src/remotion/example-usage.ts
```

## Next Steps

- **Task 11**: Implement preview service using these templates
- **Task 12**: Implement rendering service to create final videos

## Notes

- Templates are copied from reference implementations (not rebuilt from scratch)
- All templates accept props for customization
- CSS animations require importing 'animate.css'
- Transitions use remotion-transition-series package
- Configuration is centralized in config.ts
