#!/usr/bin/env tsx
/**
 * Run Auto Edit Step
 * 
 * Executes only the auto-editing step of the pipeline
 * Usage: npm run pipeline:auto-edit -- --video <path> --output <output-path>
 */

import { createLogger } from '../src/utils/logger';
import { AutoEditorService } from '../src/services/video-processing/autoEditorService';

const logger = createLogger('AutoEditStep');

async function runAutoEdit(videoPath: string, outputPath?: string) {
  logger.info('Starting auto-edit step', { videoPath });

  try {
    const autoEditorService = new AutoEditorService();
    const trimmedVideoPath = await autoEditorService.processVideo(videoPath, {
      margin: '0.2sec',
      editMode: 'audio',
      threshold: 0.04,
    });

    logger.info('Auto editing completed', { trimmedVideoPath });
    console.log(`\n✅ Auto-edit completed!`);
    console.log(`📁 Output: ${trimmedVideoPath}\n`);

  } catch (error) {
    logger.error('Auto-edit failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Auto-edit failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const videoIndex = args.indexOf('--video');

if (videoIndex === -1) {
  console.error('Usage: npm run pipeline:auto-edit -- --video <path>');
  process.exit(1);
}

const videoPath = args[videoIndex + 1];
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

runAutoEdit(videoPath, outputPath);
