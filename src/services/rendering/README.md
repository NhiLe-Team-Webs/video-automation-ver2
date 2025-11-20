# Remotion Rendering Service

The Remotion Rendering Service applies animations, effects, B-roll, and subtitles to videos using the Remotion framework.

## Features

- **Animation Application**: Apply animation templates with precise timestamp synchronization
- **Highlight Effects**: Add zoom, highlight boxes, and text overlays to emphasize key moments
- **B-roll Insertion**: Insert supplementary footage with smooth transitions
- **Subtitle Overlay**: Render subtitles from SRT files
- **Error Handling**: Comprehensive validation and detailed error logging

## Usage

### Basic Example

```typescript
import remotionRenderingService from './services/rendering';
import { EditingPlan } from './services/content-analysis';

const editingPlan: EditingPlan = {
  highlights: [],
  animations: [
    {
      startTime: 1.0,
      duration: 2.0,
      template: 'animated-text',
      text: 'Welcome!',
      parameters: { color: '#FFD700' },
    },
  ],
  transitions: [],
  brollPlacements: [],
};

const result = await remotionRenderingService.renderVideo({
  videoPath: '/path/to/input.mp4',
  editingPlan,
  outputPath: '/path/to/output.mp4',
});

console.log('Rendered:', result.outputPath);
```

### With B-roll and Subtitles

```typescript
const result = await remotionRenderingService.renderVideo({
  videoPath: '/path/to/input.mp4',
  editingPlan: myEditingPlan,
  outputPath: '/path/to/output.mp4',
  srtPath: '/path/to/subtitles.srt',
  brollVideos: [
    {
      startTime: 5.0,
      duration: 3.0,
      videoPath: '/path/to/broll.mp4',
    },
  ],
});
```

## Input Parameters

### RenderInput

- `videoPath` (string): Path to the input video file
- `editingPlan` (EditingPlan): Editing plan with animations, highlights, transitions, and B-roll placements
- `outputPath` (string): Path where the rendered video will be saved
- `srtPath` (string, optional): Path to SRT subtitle file
- `brollVideos` (BrollVideoMapping[], optional): Array of B-roll video mappings

### EditingPlan

- `highlights` (HighlightEffect[]): Highlight effects to apply
- `animations` (AnimationEffect[]): Animation effects to apply
- `transitions` (TransitionEffect[]): Transition effects to apply
- `brollPlacements` (BrollPlacement[]): B-roll placement specifications

## Output

### RenderResult

- `outputPath` (string): Path to the rendered video
- `duration` (number): Duration of the video in seconds
- `fileSize` (number): File size in bytes

## Validation

The service performs comprehensive validation:

1. **File Existence**: Validates that input video, SRT, and B-roll files exist
2. **Template Validation**: Ensures all animation templates exist
3. **Timestamp Validation**: Warns if effects extend beyond video duration
4. **Editing Plan Structure**: Validates all required fields are present

## Error Handling

Errors are logged with detailed context:

```typescript
try {
  await remotionRenderingService.renderVideo(input);
} catch (error) {
  // Error includes:
  // - Job ID for tracking
  // - Stage where error occurred
  // - Detailed error message
  // - Stack trace
}
```

## Animation Templates

Available animation templates:
- `animated-text`: Smooth text animation
- `bounce-text`: Bouncing text effect
- `slide-text`: Sliding text animation
- `typewriter-subtitle`: Typewriter effect for subtitles
- `pulsing-text`: Pulsing text animation
- `bubble-pop-text`: Bubble pop effect
- `floating-bubble-text`: Floating bubble animation
- `glitch-text`: Glitch effect
- `card-flip`: Card flip animation
- `animated-list`: Animated list items
- `geometric-patterns`: Geometric pattern animations
- `liquid-wave`: Liquid wave effect
- `matrix-rain`: Matrix rain effect
- `particle-explosion`: Particle explosion effect
- `sound-wave`: Sound wave visualization

## Highlight Effects

- `zoom`: Zoom in effect
- `highlight-box`: Golden border highlight
- `text-overlay`: Text overlay with background

## Transitions

- `fade`: Fade transition
- `slide`: Slide transition
- `wipe`: Wipe transition

## B-roll Transitions

B-roll segments automatically get transitions:
- First and last clips: Fade (0.5s)
- Middle clips: Alternating fade/slide (0.3s)

## Requirements

- FFmpeg must be installed for video metadata extraction
- Remotion bundler and renderer packages
- Sufficient disk space for temporary files

## Performance

- Rendering is CPU-intensive
- Progress is logged every 30 frames
- Temporary bundle files are created in the temp directory
- Consider running on dedicated worker nodes for production

## Integration with Pipeline

The rendering service is typically called after:
1. Video upload and validation
2. Auto-editing (silence removal)
3. Transcription
4. Highlight detection
5. Editing plan generation
6. B-roll download

And before:
1. YouTube upload
2. User notification

## Troubleshooting

### "Video file not found"
Ensure the input video path is correct and the file exists.

### "Animation template does not exist"
Check that the template name matches one of the available templates.

### "Failed to get video metadata"
Ensure FFmpeg is installed and accessible in the system PATH.

### Rendering takes too long
- Check video resolution (1080p recommended)
- Reduce number of animations
- Simplify effects
- Use faster codec settings

### Out of memory
- Reduce video resolution
- Process shorter videos
- Increase available RAM
- Use streaming rendering if available
