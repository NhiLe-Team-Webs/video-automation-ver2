import { PipelineStage } from '../../utils/errors';
import { createLogger } from '../../utils/logger';
import * as jobStorage from '../pipeline/jobStorage';
import { Job } from '../../models/job';
import { AutoEditorService } from '../video-processing/autoEditorService';
import { TranscriptionService } from '../transcription/transcriptionService';
import { SheetsStorageService } from '../transcription/sheetsStorageService';
import { HighlightDetectionService } from '../content-analysis/highlightDetectionService';
import { EditingPlanService } from '../content-analysis/editingPlanService';
import brollService from '../media/brollService';
import remotionRenderingService from '../rendering/remotionRenderingService';
import wasabiStorageService from '../storage/wasabiStorageService';
import { notificationService } from '../notification';
import path from 'path';

const logger = createLogger('PipelineOrchestrator');

export interface ProcessingResult {
  jobId: string;
  videoUrl?: string;
  status: 'completed' | 'failed';
  error?: string;
}

export interface JobStatus {
  jobId: string;
  currentStage: PipelineStage;
  progress: number;
  error?: string;
}

/**
 * Pipeline stages in order
 */
const PIPELINE_STAGES: PipelineStage[] = [
  'uploaded',
  'auto-editing',
  'transcribing',
  'storing-transcript',
  'detecting-highlights',
  'generating-plan',
  'rendering',
  'uploading',
  'completed',
];

/**
 * Handle stage error - log, update job, send notifications, and return error result
 */
async function handleStageError(
  jobId: string,
  stage: PipelineStage,
  error: unknown,
  userId?: string
): Promise<ProcessingResult> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`${stage} stage failed`, {
    jobId,
    stage,
    error: errorMessage,
    stack: errorStack,
  });

  await jobStorage.updateStage(jobId, stage, 'failed');
  await jobStorage.setJobError(jobId, stage, errorMessage, errorStack);
  await jobStorage.updateJobStatus(jobId, 'failed');

  // Send operator alert for processing errors
  try {
    await notificationService.notifyOperator({
      severity: 'error',
      jobId,
      stage,
      message: `Pipeline stage failed: ${errorMessage}`,
      timestamp: new Date(),
    });
  } catch (notifError) {
    logger.error('Failed to send operator alert', {
      jobId,
      stage,
      error: notifError instanceof Error ? notifError.message : String(notifError),
    });
  }

  // Send user notification about error
  if (userId) {
    try {
      await notificationService.notifyUser(userId, {
        type: 'error',
        jobId,
        message: `Video processing failed at ${stage} stage: ${errorMessage}`,
      });
    } catch (notifError) {
      logger.error('Failed to send user error notification', {
        jobId,
        error: notifError instanceof Error ? notifError.message : String(notifError),
      });
    }
  }

  return {
    jobId,
    status: 'failed',
    error: errorMessage,
  };
}

/**
 * Calculate progress percentage based on current stage
 */
function calculateProgress(stage: PipelineStage): number {
  const stageIndex = PIPELINE_STAGES.indexOf(stage);
  if (stageIndex === -1) return 0;
  
  // Calculate percentage (0-100)
  return Math.round((stageIndex / (PIPELINE_STAGES.length - 1)) * 100);
}

/**
 * Get current stage from job
 */
function getCurrentStage(job: Job): PipelineStage {
  // Find the last stage that's in-progress or completed
  for (let i = job.processingStages.length - 1; i >= 0; i--) {
    const stage = job.processingStages[i];
    if (stage.status === 'in-progress' || stage.status === 'completed') {
      return stage.stage;
    }
  }
  
  // If no stages started, return 'uploaded'
  return 'uploaded';
}

/**
 * Process a video through the pipeline
 * This is the main orchestration function that will be called by the worker
 */
export async function processVideo(jobId: string): Promise<ProcessingResult> {
  logger.info('Starting video processing', { jobId });

  try {
    const job = await jobStorage.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Update job status to processing
    await jobStorage.updateJobStatus(jobId, 'processing');

    // Initialize all stages as pending
    for (const stage of PIPELINE_STAGES) {
      if (stage !== 'uploaded' && stage !== 'completed' && stage !== 'failed') {
        await jobStorage.updateStage(jobId, stage, 'pending');
      }
    }

    // Mark uploaded stage as completed
    await jobStorage.updateStage(jobId, 'uploaded', 'completed');

    // Stage 1: Auto Editor - Remove silence and filler content
    logger.info('✂️ Starting Auto Editor stage', { jobId });
    await jobStorage.updateStage(jobId, 'auto-editing', 'in-progress');
    
    let autoEditedVideoPath: string;
    try {
      const autoEditorService = new AutoEditorService();
      const uploadedStage = job.processingStages.find(s => s.stage === 'uploaded');
      
      if (!uploadedStage?.outputPath) {
        throw new Error('No video path found from upload stage');
      }

      logger.info('🎬 Processing video to remove silence and filler...', { 
        jobId,
        inputPath: uploadedStage.outputPath 
      });
      
      const autoEditorResult = await autoEditorService.processVideo(uploadedStage.outputPath);
      autoEditedVideoPath = autoEditorResult.outputPath;
      
      // Upload edited video to Wasabi
      try {
        const uploadResult = await wasabiStorageService.uploadVideo(autoEditedVideoPath, jobId, 'edited');
        logger.info('Auto-edited video uploaded to Wasabi', {
          jobId,
          wasabiKey: uploadResult.key,
        });
      } catch (wasabiError) {
        logger.warn('Failed to upload auto-edited video to Wasabi (non-critical)', {
          jobId,
          error: wasabiError instanceof Error ? wasabiError.message : String(wasabiError),
        });
      }
      
      await jobStorage.updateStage(
        jobId,
        'auto-editing',
        'completed',
        autoEditedVideoPath
      );

      const reductionPercent = ((autoEditorResult.inputDuration - autoEditorResult.outputDuration) / autoEditorResult.inputDuration * 100).toFixed(1);
      
      logger.info('✅ Auto Editor stage completed', {
        jobId,
        outputPath: autoEditedVideoPath,
        inputDuration: `${autoEditorResult.inputDuration.toFixed(1)}s`,
        outputDuration: `${autoEditorResult.outputDuration.toFixed(1)}s`,
        removed: `${(autoEditorResult.inputDuration - autoEditorResult.outputDuration).toFixed(1)}s (${reductionPercent}%)`,
      });
    } catch (error) {
      return await handleStageError(jobId, 'auto-editing', error, job.userId);
    }

    // Stage 2: Transcription - Extract audio and generate transcript
    logger.info('🎤 Starting Transcription stage', { jobId });
    await jobStorage.updateStage(jobId, 'transcribing', 'in-progress');
    
    let srtPath: string;
    let transcriptSegments: any[];
    try {
      const transcriptionService = new TranscriptionService();
      
      // Extract audio from video
      logger.info('🔊 Extracting audio from video...', { jobId });
      const audioPath = await transcriptionService.extractAudio(autoEditedVideoPath);
      logger.info('✅ Audio extracted successfully', { jobId, audioPath });
      
      // Transcribe audio to SRT
      logger.info('📝 Transcribing audio to text...', { jobId });
      const transcriptResult = await transcriptionService.transcribe(audioPath);
      srtPath = transcriptResult.srtPath;
      transcriptSegments = transcriptResult.segments;
      
      await jobStorage.updateStage(
        jobId,
        'transcribing',
        'completed',
        srtPath
      );

      logger.info('✅ Transcription stage completed', {
        jobId,
        srtPath,
        segmentCount: transcriptSegments.length,
        totalDuration: transcriptSegments.length > 0 ? transcriptSegments[transcriptSegments.length - 1].end : 0
      });
    } catch (error) {
      return await handleStageError(jobId, 'transcribing', error, job.userId);
    }

    // Stage 3: Store Transcript - Save to Google Sheets
    logger.info('💾 Starting Store Transcript stage', { jobId });
    await jobStorage.updateStage(jobId, 'storing-transcript', 'in-progress');
    
    try {
      const sheetsService = new SheetsStorageService();
      logger.info('🔗 Connecting to Google Sheets...', { jobId });
      await sheetsService.initialize();
      
      logger.info('📊 Saving transcript to Google Sheets...', { 
        jobId,
        segmentCount: transcriptSegments.length 
      });
      const sheetRange = await sheetsService.saveTranscript(jobId, transcriptSegments);
      
      await jobStorage.updateStage(
        jobId,
        'storing-transcript',
        'completed',
        sheetRange
      );

      logger.info('✅ Store Transcript stage completed', {
        jobId,
        sheetRange,
        rowsSaved: transcriptSegments.length
      });
    } catch (error) {
      return await handleStageError(jobId, 'storing-transcript', error, job.userId);
    }

    // Stage 4: Highlight Detection - Identify key moments
    logger.info('⭐ Starting Highlight Detection stage', { jobId });
    await jobStorage.updateStage(jobId, 'detecting-highlights', 'in-progress');
    
    let highlights: any[];
    try {
      const highlightService = new HighlightDetectionService();
      logger.info('🔍 Analyzing transcript for highlight moments...', { jobId });
      highlights = await highlightService.detectHighlights(srtPath);
      
      await jobStorage.updateStage(
        jobId,
        'detecting-highlights',
        'completed',
        JSON.stringify({ highlightCount: highlights.length })
      );

      logger.info('✅ Highlight Detection stage completed', {
        jobId,
        highlightCount: highlights.length,
        highlights: highlights.slice(0, 3).map(h => ({
          time: `${h.startTime.toFixed(1)}s - ${h.endTime.toFixed(1)}s`,
          confidence: h.confidence,
          reason: h.reason
        }))
      });
    } catch (error) {
      return await handleStageError(jobId, 'detecting-highlights', error, job.userId);
    }

    // Stage 5: Generate Editing Plan - Use LLM to create plan
    logger.info('🎬 Starting Generate Editing Plan stage', { jobId });
    await jobStorage.updateStage(jobId, 'generating-plan', 'in-progress');
    
    let editingPlan: any;
    let videoDuration: number;
    try {
      const editingPlanService = new EditingPlanService();
      
      // Get video duration from transcript
      videoDuration = transcriptSegments.length > 0 
        ? Math.max(...transcriptSegments.map((s: any) => s.end))
        : 0;
      
      logger.info('🤖 Sending data to AI (Gemini) for editing plan generation...', {
        jobId,
        videoDuration: `${videoDuration.toFixed(1)}s`,
        transcriptSegments: transcriptSegments.length,
        highlights: highlights.length
      });
      
      editingPlan = await editingPlanService.generatePlan({
        transcript: transcriptSegments,
        highlights,
        videoDuration,
      });
      
      // Save editing plan to file for debugging
      const planPath = path.join(
        path.dirname(autoEditedVideoPath),
        `${jobId}_editing_plan.json`
      );
      await editingPlanService.savePlanToFile(editingPlan, planPath);
      
      await jobStorage.updateStage(
        jobId,
        'generating-plan',
        'completed',
        planPath
      );

      logger.info('✅ Generate Editing Plan stage completed', {
        jobId,
        planPath,
        animations: editingPlan.animations.length,
        transitions: editingPlan.transitions.length,
        brollPlacements: editingPlan.brollPlacements.length,
        highlightEffects: editingPlan.highlights.length
      });
    } catch (error) {
      return await handleStageError(jobId, 'generating-plan', error, job.userId);
    }

    // Stage 6: Download B-roll - Get supplementary footage
    logger.info('🎥 Starting B-roll Download stage', { jobId });
    
    let brollVideos: any[] = [];
    try {
      if (editingPlan.brollPlacements && editingPlan.brollPlacements.length > 0) {
        const searchTerms = editingPlan.brollPlacements.map((b: any) => b.searchTerm);
        
        logger.info('🔍 Searching for B-roll footage...', {
          jobId,
          searchTerms: searchTerms.slice(0, 3),
          totalSearches: searchTerms.length
        });
        
        try {
          const downloadedBroll = await brollService.downloadMultipleVideos(searchTerms, {
            targetDuration: editingPlan.brollPlacements.reduce((sum: number, b: any) => sum + b.duration, 0),
            maxClipDuration: 5,
          });
          
          // Map downloaded B-roll to placements
          brollVideos = editingPlan.brollPlacements.map((placement: any, index: number) => ({
            startTime: placement.startTime,
            duration: placement.duration,
            videoPath: downloadedBroll[index % downloadedBroll.length]?.localPath || '',
          })).filter((b: any) => b.videoPath);
          
          logger.info('✅ B-roll downloaded successfully', {
            jobId,
            brollCount: brollVideos.length,
            totalDuration: brollVideos.reduce((sum, b) => sum + b.duration, 0).toFixed(1) + 's'
          });
        } catch (brollError) {
          // Handle missing B-roll gracefully
          logger.warn('⚠️ B-roll download failed, trying fallback...', {
            jobId,
            error: brollError instanceof Error ? brollError.message : String(brollError),
          });
          
          // Try fallback
          try {
            const fallbackBroll = await brollService.handleMissingBroll(searchTerms);
            if (fallbackBroll.length > 0) {
              brollVideos = editingPlan.brollPlacements.map((placement: any, index: number) => ({
                startTime: placement.startTime,
                duration: placement.duration,
                videoPath: fallbackBroll[index % fallbackBroll.length]?.localPath || '',
              })).filter((b: any) => b.videoPath);
              
              logger.info('✅ Fallback B-roll downloaded', {
                jobId,
                brollCount: brollVideos.length,
              });
            }
          } catch (fallbackError) {
            logger.warn('⚠️ Fallback B-roll also failed, proceeding without B-roll', {
              jobId,
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            });
          }
        }
      } else {
        logger.info('ℹ️ No B-roll placements in editing plan, skipping B-roll download', { jobId });
      }
    } catch (error) {
      // B-roll is optional, log but don't fail
      logger.warn('⚠️ B-roll stage encountered error, continuing', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Stage 7: Rendering - Apply animations and effects
    logger.info('🎨 Starting Rendering stage', { jobId });
    await jobStorage.updateStage(jobId, 'rendering', 'in-progress');
    
    let finalVideoPath: string;
    try {
      const outputPath = path.join(
        path.dirname(autoEditedVideoPath),
        `${jobId}_final.mp4`
      );
      
      logger.info('🎬 Rendering final video with Remotion...', {
        jobId,
        animations: editingPlan.animations.length,
        transitions: editingPlan.transitions.length,
        brollClips: brollVideos.length,
        subtitles: transcriptSegments.length
      });
      
      const renderResult = await remotionRenderingService.renderVideo({
        videoPath: autoEditedVideoPath,
        editingPlan,
        outputPath,
        srtPath,
        brollVideos,
      });
      
      finalVideoPath = renderResult.outputPath;
      
      await jobStorage.updateStage(
        jobId,
        'rendering',
        'completed',
        finalVideoPath
      );

      const fileSizeMB = (renderResult.fileSize / (1024 * 1024)).toFixed(2);
      logger.info('✅ Rendering stage completed', {
        jobId,
        outputPath: finalVideoPath,
        fileSize: `${fileSizeMB} MB`,
        duration: renderResult.duration ? `${renderResult.duration.toFixed(1)}s` : 'unknown'
      });
    } catch (error) {
      return await handleStageError(jobId, 'rendering', error, job.userId);
    }

    // Stage 8: Wasabi Storage Upload - Upload final video to storage
    logger.info('☁️ Starting Wasabi Storage Upload stage', { jobId });
    await jobStorage.updateStage(jobId, 'uploading', 'in-progress');
    
    let videoUrl: string;
    try {
      logger.info('⬆️ Uploading video to Wasabi storage...', {
        jobId,
        videoPath: finalVideoPath
      });
      
      // Upload final video to Wasabi
      const uploadResult = await wasabiStorageService.uploadVideo(
        finalVideoPath,
        jobId,
        'final'
      );
      
      // Generate signed URL for download (valid for 7 days)
      videoUrl = await wasabiStorageService.getSignedUrl(uploadResult.key, {
        expiresIn: 7 * 24 * 60 * 60, // 7 days
      });
      
      await jobStorage.updateStage(
        jobId,
        'uploading',
        'completed',
        videoUrl
      );

      logger.info('✅ Wasabi Storage Upload stage completed', {
        jobId,
        videoUrl,
        key: uploadResult.key,
        size: `${(uploadResult.size / (1024 * 1024)).toFixed(2)} MB`
      });
    } catch (error) {
      return await handleStageError(jobId, 'uploading', error, job.userId);
    }

    // Mark job as completed
    await jobStorage.updateStage(jobId, 'completed', 'completed');
    await jobStorage.updateJobStatus(jobId, 'completed');

    logger.info('🎉 Video processing pipeline completed successfully!', {
      jobId,
      videoUrl,
      totalStages: 8,
      finalVideoPath
    });
    
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('✅ PIPELINE COMPLETE!');
    logger.info(`☁️ Video URL: ${videoUrl}`);
    logger.info(`🎬 Job ID: ${jobId}`);
    logger.info('═══════════════════════════════════════════════════════');

    // Send completion notification to user
    try {
      await notificationService.notifyUser(job.userId, {
        type: 'completion',
        jobId,
        videoUrl,
        message: `Your video has been successfully processed and uploaded to storage!`,
      });
    } catch (notifError) {
      logger.error('Failed to send completion notification', {
        jobId,
        error: notifError instanceof Error ? notifError.message : String(notifError),
      });
      // Don't fail the job if notification fails
    }

    return {
      jobId,
      videoUrl,
      status: 'completed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Video processing failed', {
      jobId,
      error: errorMessage,
      stack: errorStack,
    });

    // Update job with error if job exists
    const job = await jobStorage.getJob(jobId);
    if (job) {
      const currentStage = getCurrentStage(job);
      await jobStorage.setJobError(jobId, currentStage, errorMessage, errorStack);
      await jobStorage.updateJobStatus(jobId, 'failed');
    }

    return {
      jobId,
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Get job status with progress information
 */
export async function getStatus(jobId: string): Promise<JobStatus> {
  const job = await jobStorage.getJob(jobId);
  
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const currentStage = getCurrentStage(job);
  const progress = calculateProgress(currentStage);

  return {
    jobId,
    currentStage,
    progress,
    error: job.error?.message,
  };
}

/**
 * Get next stage in pipeline
 */
export function getNextStage(currentStage: PipelineStage): PipelineStage | null {
  const currentIndex = PIPELINE_STAGES.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === PIPELINE_STAGES.length - 1) {
    return null;
  }
  return PIPELINE_STAGES[currentIndex + 1];
}

/**
 * Check if stage is valid
 */
export function isValidStage(stage: string): stage is PipelineStage {
  return PIPELINE_STAGES.includes(stage as PipelineStage);
}
