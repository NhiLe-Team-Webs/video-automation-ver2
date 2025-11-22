/**
 * Example usage of EditingPlanService
 * 
 * This demonstrates how to use the LLM editing plan service
 * to generate intelligent editing plans from transcripts and highlights.
 * 
 * To run this example:
 * 1. Make sure GEMINI_API_KEY is set in your .env file
 * 2. Run: npx tsx src/services/editingPlanService.example.ts
 */

import { EditingPlanService } from './editingPlanService';
import type { EditingPlanInput } from './editingPlanService';

async function main() {
  console.log('=== EditingPlanService Example ===\n');

  // Create service instance
  const service = new EditingPlanService();

  // Example input: A short video about productivity tips
  const input: EditingPlanInput = {
    transcript: [
      { start: 0, end: 3, text: 'Welcome to my productivity tips video' },
      { start: 3, end: 7, text: 'Today I will share three amazing techniques' },
      { start: 7, end: 12, text: 'First, the Pomodoro Technique helps you focus' },
      { start: 12, end: 16, text: 'Work for 25 minutes, then take a 5 minute break' },
      { start: 16, end: 20, text: 'Second, time blocking is a game changer' },
      { start: 20, end: 25, text: 'Schedule specific tasks in your calendar' },
      { start: 25, end: 30, text: 'Third, eliminate distractions from your workspace' },
      { start: 30, end: 35, text: 'Turn off notifications and close unnecessary tabs' },
      { start: 35, end: 40, text: 'These three tips will transform your productivity' },
      { start: 40, end: 43, text: 'Thanks for watching, see you next time' },
    ],
    highlights: [
      {
        startTime: 7,
        endTime: 12,
        confidence: 0.9,
        reason: 'Key technique mentioned: Pomodoro',
      },
      {
        startTime: 16,
        endTime: 20,
        confidence: 0.85,
        reason: 'Important concept: time blocking',
      },
      {
        startTime: 25,
        endTime: 30,
        confidence: 0.8,
        reason: 'Critical advice: eliminate distractions',
      },
    ],
    videoDuration: 43,
    videoMetadata: {
      duration: 43,
      resolution: { width: 1920, height: 1080 },
      format: 'mp4',
      aspectRatio: '16:9',
    },
    brandKit: {
      name: 'Professional Tech',
      colors: {
        primary: '#2563eb',
        secondary: '#7c3aed',
        accent: '#f59e0b',
        textColor: '#ffffff',
        backgroundColor: '#1f2937',
      },
      typography: {
        fontFamily: 'Inter, sans-serif',
        fontSize: { small: 24, medium: 48, large: 72 },
        fontWeight: 700,
      },
      animationPreferences: {
        styleFamily: 'professional',
        preferredTemplates: ['animated-text', 'slide-text', 'pulsing-text'],
        timing: {
          textAppearDuration: 300,
          textDisappearDuration: 200,
          transitionDuration: 400,
          zoomDuration: 400,
        },
      },
      transitionPreferences: {
        type: 'fade',
        duration: 400,
        easing: 'ease-in-out',
      },
      effectPreferences: {
        intensity: {
          colorGrading: 0.3,
          contrast: 1.1,
          saturation: 1.1,
          sharpness: 0.2,
          vignette: 0.12,
        },
      },
    },
  };

  console.log('Input:');
  console.log(`- Transcript segments: ${input.transcript.length}`);
  console.log(`- Highlights detected: ${input.highlights.length}`);
  console.log(`- Video duration: ${input.videoDuration}s\n`);

  try {
    console.log('Generating editing plan with Gemini...\n');

    // Generate editing plan
    const plan = await service.generatePlan(input);

    console.log('✓ Editing plan generated successfully!\n');

    // Display results
    console.log('=== Editing Plan ===\n');

    console.log(`Highlight Effects: ${plan.highlights.length}`);
    plan.highlights.forEach((h, i) => {
      console.log(
        `  ${i + 1}. ${h.effectType} at ${h.startTime}s - ${h.endTime}s`
      );
    });
    console.log();

    console.log(`Animations: ${plan.animations.length}`);
    plan.animations.forEach((a, i) => {
      console.log(
        `  ${i + 1}. ${a.template} at ${a.startTime}s (${a.duration}s)${a.text ? ` - "${a.text}"` : ''}`
      );
    });
    console.log();

    console.log(`Transitions: ${plan.transitions.length}`);
    plan.transitions.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.type} at ${t.time}s (${t.duration}s)`);
    });
    console.log();

    console.log(`B-roll Placements: ${plan.brollPlacements.length}`);
    plan.brollPlacements.forEach((b, i) => {
      console.log(
        `  ${i + 1}. "${b.searchTerm}" at ${b.startTime}s (${b.duration}s) - fade in: ${b.fadeInDuration}ms, fade out: ${b.fadeOutDuration}ms`
      );
    });
    console.log();

    console.log(`Zoom Effects: ${plan.zoomEffects.length}`);
    plan.zoomEffects.forEach((z, i) => {
      console.log(
        `  ${i + 1}. ${z.id} at ${z.startTime}s - ${z.endTime}s (scale: ${z.targetScale}, duration: ${z.zoomDuration}ms)`
      );
    });
    console.log();

    console.log(`Sound Effects: ${plan.soundEffects.length}`);
    plan.soundEffects.forEach((s, i) => {
      console.log(
        `  ${i + 1}. ${s.effectType} at ${s.timestamp}s (volume: ${s.volume})`
      );
    });
    console.log();

    console.log(`Text Highlights: ${plan.textHighlights.length}`);
    plan.textHighlights.forEach((t, i) => {
      console.log(
        `  ${i + 1}. "${t.text}" at ${t.startTime}s (${t.duration}s) - ${t.style.animation}`
      );
    });
    console.log();

    console.log('Cut Filters:');
    console.log(`  - Saturation: ${plan.cutFilters.colorGrading.saturation}x`);
    console.log(`  - Contrast: ${plan.cutFilters.colorGrading.contrast}x`);
    console.log(`  - Sharpening: ${plan.cutFilters.applySharpening ? 'enabled' : 'disabled'}`);
    console.log(`  - Vignette: ${plan.cutFilters.vignetteIntensity}`);
    console.log();

    // Show full plan as JSON
    console.log('=== Full Plan (JSON) ===\n');
    console.log(JSON.stringify(plan, null, 2));
  } catch (error) {
    console.error('✗ Error generating editing plan:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the example
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
