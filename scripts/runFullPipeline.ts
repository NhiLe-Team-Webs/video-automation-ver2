#!/usr/bin/env tsx
/**
 * Run Full Pipeline
 * 
 * Executes the complete video processing pipeline from start to finish
 * Usage: npm run pipeline:full -- --video <path> --userId <userId>
 */

import { config } from '../src/config';
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
import { wasabiStorageService } from '../src/services/storage/wasabiStorageService';
import path from 'path';
import fs from 'fs/promises';

const logger = createLogger('FullPipeline');

async function runFullPipeline(videoPath: string, userId: string) {
  const jobId = `job-${Date.now()}`;
  
  logger.info('Starting full pipeline', { jobId, videoPath, userId });

  try {
    // Create job
    const job = await jobStorage.createJob(jobId, userId, videoPath);
    logger.info('Job created', { jobId });

    // Stage 1: Auto Edit
    logger.info('Stage 1: Auto Editing', { jobId });
    await jobStorage.updateStage(jobId, 'auto-editing', 'in-progress');
    const autoEditorService = new AutoEditorService();
    const trimmedVideoPath = await autoEditorService.processVideo(videoPath, {
      margin: '0.2sec',
      editMode: 'audio',
      threshold: 0.04,
    });
    await jobStorage.updateStage(jobId, 'auto-editing', 'completed', trimmedVideoPath);
    logger.info('Auto editing completed', { jobId, trimmedVideoPath });

    // Stage 2: Transcription
    logger.info('Stage 2: Transcription', { jobId });
    await jobStorage.updateStage(jobId, 'transcribing', 'in-progress');
    const transcriptionService = new TranscriptionService();
    const transcriptResult = await transcriptionService.transcribe(trimmedVideoPath);
    await jobStorage.updateStage(jobId, 'transcribing', 'completed', transcriptResult.srtPath);
    logger.info('Transcription completed', { jobId, srtPath: transcriptResult.srtPath });

    // Stage 3: Store Transcript
    logger.info('Stage 3: Storing Transcript', { jobId });
    await jobStorage.updateStage(jobId, 'storing-transcript', 'in-progress');
    const sheetsService = new SheetsStorageService();
    await sheetsService.saveTranscript(jobId, transcriptResult.segments);
    await jobStorage.updateStage(jobId, 'storing-transcript', 'completed');
    logger.info('Transcript stored', { jobId });

    // Stage 4: Highlight Detection
    logger.info('Stage 4: Highlight Detection', { jobId });
    await jobStorage.updateStage(jobId, 'detecting-highlights', 'in-progress');
    const highlightService = new HighlightDetectionService();
    const highlights = await highlightService.detectHighlights(transcriptResult.srtPath);
    await jobStorage.updateStage(jobId, 'detecting-highlights', 'completed');
    logger.info('Highlights detected', { jobId, highlightCount: highlights.length });

    // Stage 5: Generate Editing Plan
    logger.info('Stage 5: Generating Editing Plan', { jobId });
    await jobStorage.updateStage(jobId, 'generating-plan', 'in-progress');
    const editingPlanService = new EditingPlanService();
    const editingPlan = await editingPlanService.generatePlan({
      transcript: transcriptResult.segments,
      highlights,
      videoDuration: 60, // TODO: Get actual duration
    });
    await jobStorage.updateStage(jobId, 'generating-plan', 'completed');
    logger.info('Editing plan generated', { jobId });

    // Stage 6: Download B-roll
    logger.info('Stage 6: Downloading B-roll', { jobId });
    const brollVideos = [];
    for (const broll of editingPlan.brollPlacements) {
      try {
        const brollPath = await brollService.searchAndDownload(broll.searchTerm, broll.duration);
        brollVideos.push({
          startTime: broll.startTime,
          duration: broll.duration,
          videoPath: brollPath,
        });
      } catch (error) {
        logger.warn('B-roll download failed, continuing without it', {
          jobId,
          searchTerm: broll.searchTerm,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    logger.info('B-roll downloaded', { jobId, brollCount: brollVideos.length });

    // Stage 7: Render Video
    logger.info('Stage 7: Rendering Video', { jobId });
    await jobStorage.updateStage(jobId, 'rendering', 'in-progress');
    const outputPath = path.join(config.storage.tempDir, `final-${jobId}.mp4`);
    await remotionRenderingService.renderVideo({
      videoPath: trimmedVideoPath,
      editingPlan,
      outputPath,
      srtPath: transcriptResult.srtPath,
      brollVideos,
    });
    await jobStorage.updateStage(jobId, 'rendering', 'completed', outputPath);
    logger.info('Video rendered', { jobId, outputPath });

    // Stage 8: Upload to Wasabi
    logger.info('Stage 8: Uploading to Wasabi', { jobId });
    await jobStorage.updateStage(jobId, 'uploading', 'in-progress');
    const videoUrl = await wasabiStorageService.uploadVideo(outputPath, `final/${jobId}.mp4`);
    await jobStorage.updateStage(jobId, 'uploading', 'completed');
    await jobStorage.updateJobStatus(jobId, 'completed');
    await jobStorage.setYoutubeUrl(jobId, videoUrl);
    logger.info('Wasabi upload completed', { jobId, videoUrl });

    // Send completion notification
    await notificationService.notifyUser(userId, {
      type: 'completion',
      jobId,
      youtubeUrl: videoUrl,
      message: 'Your video has been processed and uploaded!',
    });

    logger.info('Full pipeline completed successfully', { jobId, videoUrl });
    console.log(`\n✅ Pipeline completed successfully!`);
    console.log(`📺 Video URL: ${videoUrl}`);
    console.log(`🆔 Job ID: ${jobId}\n`);

  } catch (error) {
    logger.error('Pipeline failed', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Pipeline failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const videoIndex = args.indexOf('--video');
const userIdIndex = args.indexOf('--userId');

if (videoIndex === -1 || userIdIndex === -1) {
  console.error('Usage: npm run pipeline:full -- --video <path> --userId <userId>');
  process.exit(1);
}

const videoPath = args[videoIndex + 1];
const userId = args[userIdIndex + 1];

runFullPipeline(videoPath, userId);
