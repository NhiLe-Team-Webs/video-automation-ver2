/**
 * Manual Test Script for B-roll Service
 * 
 * This script tests the complete flow:
 * 1. Read SRT file (transcript)
 * 2. Extract highlights/keywords
 * 3. Search and download B-roll based on keywords
 * 4. Verify downloaded videos
 * 
 * Run: npx tsx src/services/brollService.manual-test.ts
 */

import fs from 'fs/promises';
import path from 'path';
import brollService from './brollService';
import { HighlightDetectionService } from './highlightDetectionService';
import { createLogger } from '../utils/logger';

const logger = createLogger('BrollManualTest');
const highlightDetectionService = new HighlightDetectionService();

interface TestResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Step 1: Read and parse SRT file
 */
async function testReadSRT(): Promise<string[]> {
  console.log('\n📄 Step 1: Reading SRT file...\n');

  try {
    const srtPath = path.join(process.cwd(), 'temp', 'test-video_edited.srt');
    const srtContent = await fs.readFile(srtPath, 'utf-8');

    logger.info(`SRT file loaded: ${srtPath}`);
    logger.info(`Content length: ${srtContent.length} characters`);

    // Parse SRT to get text segments
    const segments = srtContent
      .split('\n\n')
      .filter((block) => block.trim())
      .map((block) => {
        const lines = block.split('\n');
        // Get the text (skip index and timestamp lines)
        return lines.slice(2).join(' ');
      })
      .filter((text) => text.trim());

    logger.info(`Parsed ${segments.length} text segments`);
    logger.info(`Sample text: "${segments[0]?.substring(0, 100)}..."`);

    results.push({
      step: 'Read SRT',
      success: true,
      data: { segments: segments.length },
    });

    return segments;
  } catch (error) {
    logger.error(`Failed to read SRT: ${error}`);
    results.push({
      step: 'Read SRT',
      success: false,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Step 2: Detect highlights and extract keywords
 */
async function testHighlightDetection(srtPath: string): Promise<string[]> {
  console.log('\n🎯 Step 2: Detecting highlights and extracting keywords...\n');

  try {
    const highlights = await highlightDetectionService.detectHighlights(srtPath);

    logger.info(`Detected ${highlights.length} highlights`);

    // Extract keywords from highlight reasons (since Highlight doesn't have keywords field)
    const keywords: string[] = [];
    
    highlights.forEach((highlight, index) => {
      logger.info(
        `Highlight ${index + 1}: ${highlight.startTime}s - ${highlight.endTime}s`
      );
      logger.info(`  Reason: "${highlight.reason}"`);
      logger.info(`  Confidence: ${highlight.confidence}`);

      // Extract keywords from reason text
      const reasonWords = highlight.reason
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3); // Only words longer than 3 chars
      
      keywords.push(...reasonWords);
    });

    // Remove duplicates and limit to top keywords
    const uniqueKeywords = [...new Set(keywords)].slice(0, 5);

    // If no keywords found, use fallback
    const finalKeywords = uniqueKeywords.length > 0 
      ? uniqueKeywords 
      : ['technology', 'innovation', 'business'];

    logger.info(`\nExtracted ${finalKeywords.length} unique keywords for B-roll:`);
    logger.info(finalKeywords.join(', '));

    results.push({
      step: 'Highlight Detection',
      success: true,
      data: {
        highlights: highlights.length,
        keywords: finalKeywords,
      },
    });

    return finalKeywords;
  } catch (error) {
    logger.error(`Failed to detect highlights: ${error}`);
    results.push({
      step: 'Highlight Detection',
      success: false,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Step 3: Search B-roll videos based on keywords
 */
async function testSearchBroll(keywords: string[]) {
  console.log('\n🔍 Step 3: Searching B-roll videos...\n');

  try {
    const allVideos = [];

    for (const keyword of keywords) {
      logger.info(`Searching for: "${keyword}"`);

      const result = await brollService.searchVideos(keyword, {
        minDuration: 3,
        orientation: 'landscape',
        perPage: 5,
      });

      logger.info(`  Found ${result.videos.length} videos`);

      if (result.videos.length > 0) {
        const video = result.videos[0];
        logger.info(
          `  Best match: ${video.id} (${video.duration}s, ${video.width}x${video.height})`
        );
        allVideos.push(...result.videos);
      }
    }

    results.push({
      step: 'Search B-roll',
      success: true,
      data: {
        keywords: keywords.length,
        videosFound: allVideos.length,
      },
    });

    return allVideos;
  } catch (error) {
    logger.error(`Failed to search B-roll: ${error}`);
    results.push({
      step: 'Search B-roll',
      success: false,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Step 4: Download B-roll videos
 */
async function testDownloadBroll(keywords: string[]) {
  console.log('\n⬇️  Step 4: Downloading B-roll videos...\n');

  try {
    const targetDuration = 15; // 15 seconds of B-roll
    logger.info(`Target duration: ${targetDuration}s`);
    logger.info(`Keywords: ${keywords.join(', ')}`);

    const downloads = await brollService.downloadMultipleVideos(keywords, {
      targetDuration,
      maxClipDuration: 5,
      orientation: 'landscape',
    });

    logger.info(`\n✅ Downloaded ${downloads.length} videos:`);

    let totalDuration = 0;
    for (const download of downloads) {
      const clipDuration = Math.min(5, download.video.duration);
      totalDuration += clipDuration;

      logger.info(
        `  - ${download.video.id}: ${clipDuration}s (${download.localPath})`
      );

      // Verify file exists
      const stats = await fs.stat(download.localPath);
      logger.info(`    File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }

    logger.info(`\nTotal B-roll duration: ${totalDuration.toFixed(1)}s`);

    results.push({
      step: 'Download B-roll',
      success: true,
      data: {
        videosDownloaded: downloads.length,
        totalDuration: totalDuration.toFixed(1),
      },
    });

    return downloads;
  } catch (error) {
    logger.error(`Failed to download B-roll: ${error}`);
    results.push({
      step: 'Download B-roll',
      success: false,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Step 5: Generate transitions for B-roll
 */
async function testGenerateTransitions(videoCount: number) {
  console.log('\n🎬 Step 5: Generating transitions...\n');

  try {
    logger.info(`Generating transitions for ${videoCount} videos:`);

    const transitions = [];
    for (let i = 0; i < videoCount; i++) {
      const transition = brollService.generateTransition(i, videoCount);
      transitions.push(transition);

      logger.info(
        `  Video ${i + 1}: ${transition.type} transition (${transition.duration}s)`
      );
    }

    results.push({
      step: 'Generate Transitions',
      success: true,
      data: { transitions: videoCount },
    });

    return transitions;
  } catch (error) {
    logger.error(`Failed to generate transitions: ${error}`);
    results.push({
      step: 'Generate Transitions',
      success: false,
      error: String(error),
    });
    throw error;
  }
}

/**
 * Print test summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.step}`);

    if (result.data) {
      Object.entries(result.data).forEach(([key, value]) => {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      });
    }

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60) + '\n');

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.\n');
  }
}

/**
 * Main test runner
 */
async function runManualTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     B-roll Service Manual Test (with SRT Integration)     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Read SRT file
    const segments = await testReadSRT();

    // Step 2: Detect highlights and extract keywords
    const srtPath = path.join(process.cwd(), 'temp', 'test-video_edited.srt');
    const keywords = await testHighlightDetection(srtPath);

    // If no keywords found, use fallback
    const searchKeywords =
      keywords.length > 0 ? keywords : ['technology', 'innovation', 'future'];

    if (keywords.length === 0) {
      logger.warn('No keywords detected, using fallback keywords');
    }

    // Step 3: Search B-roll
    await testSearchBroll(searchKeywords);

    // Step 4: Download B-roll
    const downloads = await testDownloadBroll(searchKeywords);

    // Step 5: Generate transitions
    await testGenerateTransitions(downloads.length);

    // Print summary
    printSummary();
  } catch (error) {
    logger.error(`Test failed: ${error}`);
    printSummary();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runManualTest().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runManualTest };
