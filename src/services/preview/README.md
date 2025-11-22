# Development Preview Service

## ⭐ Recommended: Use Remotion Studio

For the best preview experience, use **Remotion Studio** - the official Remotion preview tool:

```bash
# Start Remotion Studio on port 3001 (port 3000 is used by API server)
npx remotion studio src/remotion/index.ts --port 3001
```

Then open: **http://localhost:3001**

### Why Remotion Studio?

- ✅ **Real-time preview** with instant updates as you edit
- ✅ **Visual parameter editor** - no need to write JSON
- ✅ **Timeline scrubbing** and playback controls
- ✅ **Export to video** directly from the interface
- ✅ **No additional implementation** needed
- ✅ **Official Remotion tool** with full feature support
- ✅ **Hot reload** when you modify template files

### Quick Start

1. Start Remotion Studio: `npx remotion studio src/remotion/index.ts --port 3001`
2. Open http://localhost:3001 in your browser
3. Select any animation template from the left sidebar
4. Edit parameters in the right panel
5. See changes instantly in the preview window

---

## Alternative: API-based Preview Service

The Development Preview Service provides HTTP API endpoints for programmatic preview generation (used in automated workflows and production).

## Features

- **Animation Preview**: Preview individual animation templates with custom parameters
- **Transition Preview**: Preview transitions between video segments
- **Effect Preview**: Preview effects applied to videos
- **Full Video Preview**: Preview complete videos with editing plans
- **Caching**: Automatic caching of preview results for improved performance
- **Web Interface**: Browser-based interface for easy testing

## Requirements

This service implements the following requirements:
- **11.1**: Development preview interface
- **11.2**: Animation preview generation
- **11.3**: Transition preview generation
- **11.4**: Effect preview generation
- **11.5**: Full video preview with editing plan

## API Endpoints

### GET /api/preview/templates
Get list of available animation templates.

**Response:**
```json
{
  "success": true,
  "data": {
    "animated-text": {
      "name": "animated-text",
      "description": "Animated text with fade-in effect",
      "category": "text",
      "parameters": ["text", "color", "fontSize"]
    }
  }
}
```

### GET /api/preview/transitions
Get list of available transitions.

**Response:**
```json
{
  "success": true,
  "data": {
    "fade": {
      "name": "Fade",
      "description": "Simple fade transition between scenes",
      "type": "basic"
    }
  }
}
```

### POST /api/preview/animation
Generate preview for an animation template.

**Request:**
```json
{
  "template": "animated-text",
  "parameters": {
    "text": "Hello World",
    "color": "#4CAF50",
    "fontSize": 48
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "previewUrl": "/previews/preview-animated-text-123456.mp4",
    "duration": 5.0,
    "thumbnailUrl": "/previews/preview-animated-text-123456-thumb.jpg"
  }
}
```

### POST /api/preview/transition
Generate preview for a transition between video segments.

**Request:**
```json
{
  "type": "fade",
  "videoSegments": [
    {
      "videoPath": "/path/to/video1.mp4",
      "startTime": 0,
      "endTime": 5
    },
    {
      "videoPath": "/path/to/video2.mp4",
      "startTime": 0,
      "endTime": 5
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "previewUrl": "/previews/preview-transition-fade-123456.mp4",
    "duration": 10.5,
    "thumbnailUrl": "/previews/preview-transition-fade-123456-thumb.jpg"
  }
}
```

### POST /api/preview/effect
Generate preview for an effect applied to a video.

**Request:**
```json
{
  "effect": {
    "type": "zoom",
    "parameters": {
      "intensity": 1.5
    },
    "startTime": 0,
    "duration": 2
  },
  "videoPath": "/path/to/video.mp4"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "previewUrl": "/previews/preview-effect-zoom-123456.mp4",
    "duration": 2.0,
    "thumbnailUrl": "/previews/preview-effect-zoom-123456-thumb.jpg"
  }
}
```

### POST /api/preview/full-video
Generate preview for a full video with editing plan.

**Request:**
```json
{
  "editingPlan": {
    "highlights": [
      {
        "startTime": 10,
        "endTime": 15,
        "effectType": "zoom",
        "parameters": { "intensity": 1.2 }
      }
    ],
    "animations": [
      {
        "startTime": 5,
        "duration": 3,
        "template": "animated-text",
        "text": "Important Point",
        "parameters": { "color": "#FF5722" }
      }
    ],
    "transitions": [
      {
        "time": 20,
        "type": "fade",
        "duration": 1
      }
    ],
    "brollPlacements": [
      {
        "startTime": 30,
        "duration": 5,
        "searchTerm": "nature"
      }
    ]
  },
  "videoPath": "/path/to/video.mp4"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "previewUrl": "/previews/preview-full-123456.mp4",
    "duration": 60.0,
    "thumbnailUrl": "/previews/preview-full-123456-thumb.jpg"
  }
}
```

### DELETE /api/preview/cache
Clear the preview cache.

**Response:**
```json
{
  "success": true,
  "message": "Preview cache cleared"
}
```

## Web Interface

Access the web-based preview interface at:
```
http://localhost:3000/preview
```

The interface provides:
- Tabbed navigation for different preview types
- Form inputs for parameters
- Real-time preview generation
- Video playback with controls
- Preview metadata display

## Usage Example

```typescript
import { PreviewService } from './services/preview';

const previewService = new PreviewService();
await previewService.initialize();

// Preview an animation
const animationPreview = await previewService.previewAnimation(
  'animated-text',
  { text: 'Hello World', color: '#4CAF50' }
);

console.log('Preview URL:', animationPreview.previewUrl);
console.log('Duration:', animationPreview.duration);

// Preview a transition
const transitionPreview = await previewService.previewTransition(
  'fade',
  [
    { videoPath: '/video1.mp4', startTime: 0, endTime: 5 },
    { videoPath: '/video2.mp4', startTime: 0, endTime: 5 }
  ]
);

// Clear cache when done
await previewService.clearCache();
```

## Caching

The preview service automatically caches generated previews to improve performance:

- Cache keys are generated from preview type and parameters
- Cached previews are returned immediately without re-rendering
- Cache can be cleared via API or programmatically
- Cache directory: `temp/previews/`

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common error codes:
- `400`: Invalid request (missing parameters, invalid format)
- `404`: Resource not found (video file, template)
- `500`: Internal server error (rendering failure)

## Testing

Run tests with:
```bash
npm test src/services/preview/previewService.test.ts
npm test src/api/previewRoutes.test.ts
```

## Notes

- Preview generation requires Remotion bundling and rendering
- Large videos may take time to preview
- Caching significantly improves performance for repeated previews
- The web interface is designed for development use only
