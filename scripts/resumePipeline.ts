#!/usr/bin/env tsx
/**
 * Resume Pipeline from Last Checkpoint
 * 
 * Resumes a failed or interrupted pipeline from the last successful stage
 * Usage: npm run pipeline:resume -- --jobId <jobId>
 */

import { createLogger } from '../src/utils/logger';
import * as jobStorage from '../src/services/pipeline/jobStorage';
import { AutoEditorService } from '../src/services/video-processing/autoEditorService';
import { TranscriptionService } from '../src/services/transcription/transcriptionService';
import { SheetsStorageService } from '../src/services/transcription/sheetsStorageService';
import { HighlightDetectionService } from '../src/services/content-analysis/highlightDetectionService';
import { EditingPlanService } from '../src/services/content-analysis/editingPlanService';
import brollService from '../src/services/media/brollService';
import remotionRenderingService from '../src/services/rendering/remotionRenderingService';
import { notificationService } from '../src/services/notification';
import path from 'path';

const logger = createLogger('ResumePipeline');

async function resumePipeline(jobId: string) {
  logger.info('Resuming pipeline', { jobId });

  try {
    // Get job status
    const job = await jobStorage.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    console.log(`\n📋 Job Status: ${job.status}`);
    console.log(`📊 Processing Stages:`);
    job.processingStages.forEach(stage => {
      const icon = stage.status === 'completed' ? '✅' : 
                   stage.status === 'failed' ? '❌' : 
                   stage.status === 'in-progress' ? '⏳' : '⏸️';
      console.log(`   ${icon} ${stage.stage}: ${stage.status}`);
    });
    console.log();

    // Find last completed stage
    const completedStages = job.processingStages.filter(s => s.status === 'completed');
    const lastCompleted = completedStages[completedStages.length - 1];
    
    if (!lastCompleted) {
      console.log('No completed stages found. Please run the full pipeline.');
      return;
    }

    console.log(`🔄 Resuming from: ${lastCompleted.stage}\n`);

    // Resume from next stage
    // This is a simplified version - you would implement the full logic here
    console.log('⚠️  Resume functionality requires full implementation based on last completed stage.');
    console.log('For now, please run individual pipeline steps manually:\n');
    console.log('  npm run pipeline:auto-edit -- --video <path>');
    console.log('  npm run pipeline:transcribe -- --video <path>');
    console.log('  npm run pipeline:highlights -- --srt <path>');
    console.log('  npm run pipeline:editing-plan -- --srt <path> --duration <seconds>');
    console.log('  npm run pipeline:render -- --video <path> --plan <path> --output <path>\n');

  } catch (error) {
    logger.error('Resume pipeline failed', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Resume failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const jobIdIndex = args.indexOf('--jobId');

if (jobIdIndex === -1) {
  console.error('Usage: npm run pipeline:resume -- --jobId <jobId>');
  process.exit(1);
}

const jobId = args[jobIdIndex + 1];

resumePipeline(jobId);
