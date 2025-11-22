/**
 * Manual test for Sound Effects Service
 * 
 * This file demonstrates how to use the sound effects service.
 * Run with: npx tsx src/services/media/soundEffectsService.manual-test.ts
 * 
 * Prerequisites:
 * 1. Set PIXABAY_API_KEY in .env file
 * 2. Get API key from: https://pixabay.com/api/docs/
 */

import soundEffectsService from './soundEffectsService';
import type { SoundEffectCategory } from './soundEffectsService';

async function testSoundEffectsService() {
  console.log('=== Sound Effects Service Manual Test ===\n');

  try {
    // Test 1: Search for sound effects
    console.log('Test 1: Searching for whoosh sound effects...');
    const searchResult = await soundEffectsService.searchSoundEffect('whoosh', 2.0, {
      maxResults: 5,
    });
    console.log(`Found ${searchResult.effects.length} sound effects`);
    console.log('First result:', {
      id: searchResult.effects[0]?.id,
      name: searchResult.effects[0]?.name,
      duration: searchResult.effects[0]?.duration,
      category: searchResult.effects[0]?.category,
    });
    console.log('✓ Search test passed\n');

    // Test 2: Download a sound effect
    console.log('Test 2: Downloading sound effect...');
    const downloadResult = await soundEffectsService.getSoundEffectForCategory('pop', 1.0);
    console.log(`Downloaded to: ${downloadResult.localPath}`);
    console.log('Effect details:', {
      id: downloadResult.effect.id,
      name: downloadResult.effect.name,
      duration: downloadResult.effect.duration,
      category: downloadResult.effect.category,
    });
    console.log('✓ Download test passed\n');

    // Test 3: Download multiple categories
    console.log('Test 3: Downloading multiple sound effects...');
    const categories: SoundEffectCategory[] = ['whoosh', 'pop', 'text-appear'];
    const multipleResults = await soundEffectsService.downloadMultipleSoundEffects(categories);
    console.log(`Downloaded ${multipleResults.size} sound effects:`);
    for (const [category, result] of multipleResults.entries()) {
      console.log(`  - ${category}: ${result.localPath}`);
    }
    console.log('✓ Multiple download test passed\n');

    // Test 4: Volume calculation
    console.log('Test 4: Testing volume calculations...');
    const mainAudioPeak = 0.8;
    const recommendedVolume = soundEffectsService.calculateRecommendedVolume(mainAudioPeak);
    console.log(`Main audio peak: ${mainAudioPeak}`);
    console.log(`Recommended SFX volume: ${recommendedVolume} (${(recommendedVolume / mainAudioPeak * 100).toFixed(1)}%)`);
    console.log('✓ Volume calculation test passed\n');

    // Test 5: Volume validation
    console.log('Test 5: Testing volume validation...');
    const mainAudio = {
      path: '/path/to/main.mp3',
      peakVolume: 1.0,
      averageVolume: 0.7,
    };
    const sfxAudio = {
      path: '/path/to/sfx.mp3',
      peakVolume: 0.25,
      averageVolume: 0.2,
    };
    const validation = soundEffectsService.validateVolumeLevels(mainAudio, sfxAudio);
    console.log('Validation result:', {
      isValid: validation.isValid,
      mainAudioPeak: validation.mainAudioPeak,
      sfxPeak: validation.sfxPeak,
      recommendedSfxVolume: validation.recommendedSfxVolume,
    });
    console.log('✓ Volume validation test passed\n');

    // Test 6: Cache reuse
    console.log('Test 6: Testing cache reuse...');
    console.log('Downloading same sound effect again (should use cache)...');
    const cachedResult = await soundEffectsService.getSoundEffectForCategory('pop', 1.0);
    console.log(`Result: ${cachedResult.localPath}`);
    console.log('✓ Cache test passed\n');

    console.log('=== All tests passed! ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testSoundEffectsService();
