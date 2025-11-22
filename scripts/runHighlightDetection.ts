#!/usr/bin/env tsx
/**
 * Run Highlight Detection Step
 * 
 * Executes only the highlight detection step of the pipeline
 * Usage: npm run pipeline:highlights -- --srt <path>
 */

import { createLogger } from '../src/utils/logger';
import { HighlightDetectionService } from '../src/services/content-analysis/highlightDetectionService';

const logger = createLogger('HighlightDetectionStep');

async function runHighlightDetection(srtPath: string) {
  logger.info('Starting highlight detection step', { srtPath });

  try {
    const highlightService = new HighlightDetectionService();
    const highlights = await highlightService.detectHighlights(srtPath);

    logger.info('Highlight detection completed', { highlightCount: highlights.length });
    
    console.log(`\n✅ Highlight detection completed!`);
    console.log(`🎯 Highlights found: ${highlights.length}\n`);

    // Display highlights
    if (highlights.length > 0) {
      console.log('Detected highlights:');
      highlights.forEach((highlight, i) => {
        console.log(`  ${i + 1}. [${highlight.startTime.toFixed(2)}s - ${highlight.endTime.toFixed(2)}s]`);
        console.log(`     Reason: ${highlight.reason}`);
        console.log(`     Confidence: ${(highlight.confidence * 100).toFixed(1)}%`);
      });
      console.log();
    } else {
      console.log('No highlights detected. Will use default parameters.\n');
    }

  } catch (error) {
    logger.error('Highlight detection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Highlight detection failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const srtIndex = args.indexOf('--srt');

if (srtIndex === -1) {
  console.error('Usage: npm run pipeline:highlights -- --srt <path>');
  process.exit(1);
}

const srtPath = args[srtIndex + 1];

runHighlightDetection(srtPath);
