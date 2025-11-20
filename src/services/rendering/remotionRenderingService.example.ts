/**
 * Example usage of RemotionRenderingService
 * 
 * This demonstrates how to render a video with animations, B-roll, and subtitles
 */

import remotionRenderingService from './remotionRenderingService';
import { EditingPlan } from '../content-analysis/editingPlanService';

async function exampleRenderVideo() {
  // Example editing plan
  const editingPlan: EditingPlan = {
    // Highlight effects
    highlights: [
      {
        startTime: 2.0,
        endTime: 4.0,
        effectType: 'zoom',
        parameters: {},
      },
      {
        startTime: 8.0,
        endTime: 10.0,
        effectType: 'highlight-box',
        parameters: {},
      },
    ],

    // Animations
    animations: [
      {
        startTime: 1.0,
        duration: 2.0,
        template: 'animated-text',
        text: 'Welcome!',
        parameters: {
          color: '#FFD700',
          fontSize: 48,
        },
      },
      {
        startTime: 5.0,
        duration: 3.0,
        template: 'bounce-text',
        text: 'Important Point',
        parameters: {
          color: '#FF6B6B',
        },
      },
    ],

    // Transitions
    transitions: [
      {
        time: 4.0,
        type: 'fade',
        duration: 0.5,
      },
      {
        time: 10.0,
        type: 'slide',
        duration: 0.8,
      },
    ],

    // B-roll placements
    brollPlacements: [
      {
        startTime: 6.0,
        duration: 3.0,
        searchTerm: 'nature landscape',
      },
    ],
  };

  // B-roll video mappings (after downloading from Pexels)
  const brollVideos = [
    {
      startTime: 6.0,
      duration: 3.0,
      videoPath: '/path/to/downloaded/broll1.mp4',
    },
  ];

  try {
    console.log('Starting video rendering...');

    const result = await remotionRenderingService.renderVideo({
      videoPath: '/path/to/input/video.mp4',
      editingPlan,
      outputPath: '/path/to/output/final-video.mp4',
      srtPath: '/path/to/subtitles.srt', // Optional
      brollVideos, // Optional
    });

    console.log('Video rendered successfully!');
    console.log('Output path:', result.outputPath);
    console.log('Duration:', result.duration, 'seconds');
    console.log('File size:', (result.fileSize / 1024 / 1024).toFixed(2), 'MB');
  } catch (error) {
    console.error('Rendering failed:', error);
  }
}

// Example with minimal editing plan (no B-roll or subtitles)
async function exampleMinimalRender() {
  const editingPlan: EditingPlan = {
    highlights: [],
    animations: [
      {
        startTime: 1.0,
        duration: 2.0,
        template: 'typewriter-subtitle',
        text: 'Hello World',
        parameters: {},
      },
    ],
    transitions: [],
    brollPlacements: [],
  };

  try {
    const result = await remotionRenderingService.renderVideo({
      videoPath: '/path/to/input/video.mp4',
      editingPlan,
      outputPath: '/path/to/output/simple-video.mp4',
    });

    console.log('Simple video rendered:', result.outputPath);
  } catch (error) {
    console.error('Rendering failed:', error);
  }
}

// Run examples (uncomment to test)
// exampleRenderVideo();
// exampleMinimalRender();

export { exampleRenderVideo, exampleMinimalRender };
