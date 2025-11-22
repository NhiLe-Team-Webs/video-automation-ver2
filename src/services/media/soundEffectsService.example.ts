/**
 * Example usage of Sound Effects Service
 * 
 * This file demonstrates how to integrate sound effects into the video pipeline.
 */

import soundEffectsService from './soundEffectsService';
import type { SoundEffectCategory, SoundEffectDownloadResult } from './soundEffectsService';

/**
 * Example 1: Download sound effects for an editing plan
 */
async function downloadSoundEffectsForEditingPlan() {
  console.log('Example 1: Downloading sound effects for editing plan\n');

  // Determine which categories we need based on the editing plan
  const requiredCategories: SoundEffectCategory[] = [
    'text-appear',  // For text highlights
    'zoom',         // For zoom effects
    'transition',   // For scene transitions
    'whoosh',       // For fast movements
  ];

  // Download all required sound effects
  const soundEffects = await soundEffectsService.downloadMultipleSoundEffects(requiredCategories);

  console.log(`Downloaded ${soundEffects.size} sound effects:`);
  for (const [category, result] of soundEffects.entries()) {
    console.log(`  ${category}: ${result.localPath}`);
  }

  return soundEffects;
}

/**
 * Example 2: Apply sound effect with volume adjustment
 */
async function applySoundEffectWithVolumeAdjustment() {
  console.log('\nExample 2: Applying sound effect with volume adjustment\n');

  // Get main audio track info (this would come from FFmpeg analysis)
  const mainAudio = {
    path: '/path/to/main-audio.mp3',
    peakVolume: 0.85,
    averageVolume: 0.6,
  };

  // Download a sound effect
  const sfxResult = await soundEffectsService.getSoundEffectForCategory('pop', 1.0);

  // Calculate recommended volume
  const recommendedVolume = soundEffectsService.calculateRecommendedVolume(mainAudio.peakVolume);

  console.log('Main audio peak:', mainAudio.peakVolume);
  console.log('Recommended SFX volume:', recommendedVolume);
  console.log('Percentage:', `${(recommendedVolume / mainAudio.peakVolume * 100).toFixed(1)}%`);

  // In actual implementation, you would use FFmpeg to apply the volume:
  // ffmpeg -i main.mp3 -i sfx.mp3 -filter_complex "[1:a]volume=${recommendedVolume}[sfx];[0:a][sfx]amix=inputs=2" output.mp3

  return {
    sfxPath: sfxResult.localPath,
    volume: recommendedVolume,
  };
}

/**
 * Example 3: Validate sound effect volumes
 */
async function validateSoundEffectVolumes() {
  console.log('\nExample 3: Validating sound effect volumes\n');

  const mainAudio = {
    path: '/path/to/main-audio.mp3',
    peakVolume: 1.0,
    averageVolume: 0.7,
  };

  // Simulate different SFX volumes
  const testCases = [
    { name: 'Too quiet', peakVolume: 0.15 },
    { name: 'Perfect', peakVolume: 0.25 },
    { name: 'Too loud', peakVolume: 0.35 },
  ];

  for (const testCase of testCases) {
    const sfxAudio = {
      path: '/path/to/sfx.mp3',
      peakVolume: testCase.peakVolume,
      averageVolume: testCase.peakVolume * 0.8,
    };

    const validation = soundEffectsService.validateVolumeLevels(mainAudio, sfxAudio);

    console.log(`${testCase.name}:`);
    console.log(`  SFX Peak: ${sfxAudio.peakVolume}`);
    console.log(`  Valid: ${validation.isValid}`);
    console.log(`  Recommended: ${validation.recommendedSfxVolume}`);
    console.log();
  }
}

/**
 * Example 4: Integration with editing plan
 */
interface TextHighlight {
  text: string;
  startTime: number;
  duration: number;
}

interface ZoomEffect {
  startTime: number;
  endTime: number;
}

interface TransitionEffect {
  time: number;
  type: string;
}

async function integrateWithEditingPlan(
  textHighlights: TextHighlight[],
  zoomEffects: ZoomEffect[],
  transitions: TransitionEffect[]
) {
  console.log('\nExample 4: Integrating with editing plan\n');

  // Download required sound effects
  const soundEffects = new Map<SoundEffectCategory, SoundEffectDownloadResult>();

  if (textHighlights.length > 0) {
    const textSfx = await soundEffectsService.getSoundEffectForCategory('text-appear');
    soundEffects.set('text-appear', textSfx);
  }

  if (zoomEffects.length > 0) {
    const zoomSfx = await soundEffectsService.getSoundEffectForCategory('zoom');
    soundEffects.set('zoom', zoomSfx);
  }

  if (transitions.length > 0) {
    const transitionSfx = await soundEffectsService.getSoundEffectForCategory('transition');
    soundEffects.set('transition', transitionSfx);
  }

  // Build sound effect placements
  const soundEffectPlacements = [];

  // Add SFX for text highlights
  for (const highlight of textHighlights) {
    const sfx = soundEffects.get('text-appear');
    if (sfx) {
      soundEffectPlacements.push({
        timestamp: highlight.startTime,
        effectType: 'text-appear',
        soundEffectPath: sfx.localPath,
        volume: 0.25,
      });
    }
  }

  // Add SFX for zoom effects
  for (const zoom of zoomEffects) {
    const sfx = soundEffects.get('zoom');
    if (sfx) {
      soundEffectPlacements.push({
        timestamp: zoom.startTime,
        effectType: 'zoom',
        soundEffectPath: sfx.localPath,
        volume: 0.25,
      });
    }
  }

  // Add SFX for transitions
  for (const transition of transitions) {
    const sfx = soundEffects.get('transition');
    if (sfx) {
      soundEffectPlacements.push({
        timestamp: transition.time,
        effectType: 'transition',
        soundEffectPath: sfx.localPath,
        volume: 0.25,
      });
    }
  }

  console.log(`Created ${soundEffectPlacements.length} sound effect placements`);
  return soundEffectPlacements;
}

/**
 * Example 5: Cache management
 */
async function manageSoundEffectCache() {
  console.log('\nExample 5: Managing sound effect cache\n');

  // Download some sound effects (they will be cached)
  console.log('Downloading sound effects...');
  await soundEffectsService.getSoundEffectForCategory('whoosh');
  await soundEffectsService.getSoundEffectForCategory('pop');

  // Download again (should use cache)
  console.log('Downloading again (should use cache)...');
  await soundEffectsService.getSoundEffectForCategory('whoosh');

  // Clear cache for specific category
  console.log('Clearing cache for whoosh category...');
  await soundEffectsService.clearCache('whoosh');

  // Clear all cache
  console.log('Clearing all cache...');
  await soundEffectsService.clearCache();

  console.log('Cache management complete');
}

// Export examples for use in other files
export {
  downloadSoundEffectsForEditingPlan,
  applySoundEffectWithVolumeAdjustment,
  validateSoundEffectVolumes,
  integrateWithEditingPlan,
  manageSoundEffectCache,
};

// Run examples if executed directly
if (require.main === module) {
  (async () => {
    try {
      await downloadSoundEffectsForEditingPlan();
      await applySoundEffectWithVolumeAdjustment();
      await validateSoundEffectVolumes();
      
      // Example editing plan data
      await integrateWithEditingPlan(
        [{ text: 'Hello World', startTime: 1.0, duration: 2.0 }],
        [{ startTime: 3.0, endTime: 3.4 }],
        [{ time: 5.0, type: 'fade' }]
      );
      
      await manageSoundEffectCache();
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}
