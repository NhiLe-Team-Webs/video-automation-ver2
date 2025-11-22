# Brand Kit and Style Guide Service

This service manages brand kit configuration and style guide generation for consistent visual styling across video editing.

## Overview

The Brand Kit Service provides:
- **Brand Kit Loading**: Load brand configuration from JSON files
- **Style Guide Generation**: Generate style guides based on brand kit and video metadata
- **Style Validation**: Validate editing plans against style guides
- **Style Application**: Apply style guides to visual elements

## Brand Kit Schema

A brand kit defines the visual identity for your videos:

```typescript
interface BrandKit {
  name: string;
  version: string;
  colors: ColorScheme;
  typography: Typography;
  animationPreferences: AnimationPreferences;
  transitionPreferences: TransitionPreferences;
  effectPreferences: EffectPreferences;
}
```

### Style Families

Available style families:
- **modern**: Clean, contemporary animations (animated-text, slide-text, geometric-patterns, liquid-wave)
- **minimal**: Simple, understated effects (animated-text, slide-text, pulsing-text)
- **dynamic**: High-energy, bold animations (bounce-text, particle-explosion, sound-wave, glitch-text)
- **playful**: Fun, whimsical effects (bubble-pop-text, floating-bubble-text, bounce-text, card-flip)
- **professional**: Business-appropriate, polished animations (animated-text, slide-text, pulsing-text, typewriter-subtitle)

## Usage

### Loading a Brand Kit

```typescript
import { BrandKitService } from './services/style';

const service = new BrandKitService();

// Load from default location (brand-kit.json)
const brandKit = await service.loadBrandKit();

// Load from custom path
const customBrandKit = await service.loadBrandKit('./my-brand-kit.json');
```

### Generating a Style Guide

```typescript
const videoMetadata = {
  duration: 120,
  resolution: { width: 1920, height: 1080 },
  format: 'mp4',
  aspectRatio: '16:9',
};

const styleGuide = await service.generateStyleGuide(videoMetadata);
```

### Validating Style Consistency

```typescript
const editingPlan = {
  animations: [...],
  transitions: [...],
  textHighlights: [...],
};

const validation = service.validateStyleConsistency(editingPlan, styleGuide);

if (!validation.isConsistent) {
  console.log('Style violations:', validation.violations);
}
```

### Applying Style Guide

```typescript
const element = {
  type: 'text',
  properties: {
    text: 'Hello World',
  },
};

const styledElement = service.applyStyleGuide(element, styleGuide);
```

## Configuration

### Example Brand Kit

See `brand-kit.example.json` for a complete example:

```json
{
  "name": "Professional Tech Brand",
  "version": "1.0.0",
  "colors": {
    "primary": "#2563eb",
    "secondary": "#7c3aed",
    "accent": "#f59e0b",
    "textColor": "#ffffff",
    "backgroundColor": "#1f2937"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "fontSize": {
      "small": 24,
      "medium": 48,
      "large": 72
    },
    "fontWeight": 700,
    "lineHeight": 1.2
  },
  "animationPreferences": {
    "styleFamily": "professional",
    "preferredTemplates": [
      "animated-text",
      "slide-text",
      "pulsing-text"
    ],
    "timing": {
      "textAppearDuration": 300,
      "textDisappearDuration": 200,
      "transitionDuration": 400,
      "zoomDuration": 400
    }
  },
  "transitionPreferences": {
    "type": "fade",
    "duration": 400,
    "easing": "ease-in-out"
  },
  "effectPreferences": {
    "intensity": {
      "colorGrading": 0.3,
      "contrast": 1.1,
      "saturation": 1.1,
      "sharpness": 0.2,
      "vignette": 0.12
    }
  }
}
```

## Validation Rules

The service enforces these validation rules:

### Brand Kit Validation
- Style family must be one of: modern, minimal, dynamic, playful, professional
- Transition duration must be between 300-500ms
- Saturation must be between 0.5 and 1.5
- Contrast must be between 0.8 and 1.3
- Vignette must be between 0.1 and 0.15
- Colors must be valid hex format (#RRGGBB)

### Style Consistency Validation
- All animations must use templates from the selected style family
- All transitions must use the same transition type
- All transition durations must be between 300-500ms
- Text highlights should use consistent font family and colors

## Crown Mercado Brand Integration

The service includes built-in support for Crown Mercado brand constants:

```typescript
import { crownMercadoBrandKit, getBrandColors } from './services/style';

// Get Crown Mercado brand kit
const brandKit = crownMercadoBrandKit();

// Get brand colors for templates
const colors = getBrandColors();
console.log(colors.primaryRed); // #C8102E
console.log(colors.charcoal);   // #1C1C1C
```

### Crown Mercado Brand Identity

- **Primary Color**: Red (#C8102E) - Bold, innovative
- **Secondary Color**: Charcoal (#1C1C1C) - Professional, trustworthy
- **Typography**: Montserrat (headlines), Open Sans (body)
- **Style Family**: Professional
- **Preferred Templates**: animated-text, slide-text, geometric-patterns
- **Graphic Motif**: Layered triangles in red gradients (futuristic + dynamic)

## Integration with Editing Plan Service

The brand kit service integrates with the editing plan service to ensure consistent styling:

```typescript
import { BrandKitService } from './services/style';
import { EditingPlanService } from './services/content-analysis';

const brandKitService = new BrandKitService();
const editingPlanService = new EditingPlanService();

// Load brand kit
const brandKit = await brandKitService.loadBrandKit();

// Generate style guide
const styleGuide = await brandKitService.generateStyleGuide(videoMetadata);

// Generate editing plan (will use style guide)
const editingPlan = await editingPlanService.generatePlan(input, styleGuide);

// Validate consistency
const validation = brandKitService.validateStyleConsistency(editingPlan, styleGuide);
```

## Error Handling

The service throws `ProcessingError` for:
- Invalid brand kit files
- Missing required fields
- Invalid configuration values
- File system errors

All errors are logged with structured logging for debugging.

## Testing

Run tests with:

```bash
npm test src/services/style/brandKitService.test.ts
```

The test suite covers:
- Brand kit loading and validation
- Style guide generation
- Style consistency validation
- Style application to elements
- Error handling for invalid configurations
