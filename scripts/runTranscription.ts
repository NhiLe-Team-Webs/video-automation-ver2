#!/usr/bin/env tsx
/**
 * Run Transcription Step
 * 
 * Executes only the transcription step of the pipeline
 * Usage: npm run pipeline:transcribe -- --video <path>
 */

import { createLogger } from '../src/utils/logger';
import { TranscriptionService } from '../src/services/transcription/transcriptionService';

const logger = createLogger('TranscriptionStep');

async function runTranscription(videoPath: string) {
  logger.info('Starting transcription step', { videoPath });

  try {
    const transcriptionService = new TranscriptionService();
    const transcriptResult = await transcriptionService.transcribe(videoPath);

    logger.info('Transcription completed', { 
      srtPath: transcriptResult.srtPath,
      segments: transcriptResult.segments.length 
    });
    
    console.log(`\n✅ Transcription completed!`);
    console.log(`📁 SRT File: ${transcriptResult.srtPath}`);
    console.log(`📝 Segments: ${transcriptResult.segments.length}\n`);

    // Display first few segments
    console.log('First 3 segments:');
    transcriptResult.segments.slice(0, 3).forEach((seg, i) => {
      console.log(`  ${i + 1}. [${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s] ${seg.text}`);
    });
    console.log();

  } catch (error) {
    logger.error('Transcription failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Transcription failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const videoIndex = args.indexOf('--video');

if (videoIndex === -1) {
  console.error('Usage: npm run pipeline:transcribe -- --video <path>');
  process.exit(1);
}

const videoPath = args[videoIndex + 1];

runTranscription(videoPath);
