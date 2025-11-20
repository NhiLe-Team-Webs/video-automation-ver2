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
import { YouTubeUploadService } from '../youtube/youtubeUploadService';
import path from 'path';

const logger = createLogger('PipelineOrchestrator');

export interface ProcessingResult {
  jobId: string;
  youtubeUrl?: string;
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
 * Handle stage error - log, update job, and return error result
 */
function handleStageError(
  jobId: string,
  stage: PipelineStage,
  error: unknown
): ProcessingResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`${stage} stage failed`, {
    jobId,
    stage,
    error: errorMessage,
    stack: errorStack,
  });

  jobStorage.updateStage(jobId, stage, 'failed');
  jobStorage.setJobError(jobId, stage, errorMessage, errorStack);
  jobStorage.updateJobStatus(jobId, 'failed');

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
    const job = jobStorage.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Update job status to processing
    jobStorage.updateJobStatus(jobId, 'processing');

    // Initialize all stages as pending
    for (const stage of PIPELINE_STAGES) {
      if (stage !== 'uploaded' && stage !== 'completed' && stage !== 'failed') {
        jobStorage.updateStage(jobId, stage, 'pending');
      }
    }

    // Mark uploaded stage as completed
    jobStorage.updateStage(jobId, 'uploaded', 'completed');

    // Stage 1: Auto Editor - Remove silence and filler content
    logger.info('Starting Auto Editor stage', { jobId });
    jobStorage.updateStage(jobId, 'auto-editing', 'in-progress');
    
    let autoEditedVideoPath: string;
    try {
      const autoEditorService = new AutoEditorService();
      const uploadedStage = job.processingStages.find(s => s.stage === 'uploaded');
      
      if (!uploadedStage?.outputPath) {
        throw new Error('No video path found from upload stage');
      }

      const autoEditorResult = await autoEditorService.processVideo(uploadedStage.outputPath);
      autoEditedVideoPath = autoEditorResult.outputPath;
      
      jobStorage.updateStage(
        jobId,
        'auto-editing',
        'completed',
        autoEditedVideoPath
      );

      logger.info('Auto Editor stage completed', {
        jobId,
        outputPath: autoEditedVideoPath,
        durationReduction: autoEditorResult.inputDuration - autoEditorResult.outputDuration,
      });
    } catch (error) {
      return handleStageError(jobId, 'auto-editing', error);
    }

    // Stage 2: Transcription - Extract audio and generate transcript
    logger.info('Starting Transcription stage', { jobId });
    jobStorage.updateStage(jobId, 'transcribing', 'in-progress');
    
    let srtPath: string;
    let transcriptSegments: any[];
    try {
      const transcriptionService = new TranscriptionService();
      
      // Extract audio from video
      const audioPath = await transcriptionService.extractAudio(autoEditedVideoPath);
      
      // Transcribe audio to SRT
      const transcriptResult = await transcriptionService.transcribe(audioPath);
      srtPath = transcriptResult.srtPath;
      transcriptSegments = transcriptResult.segments;
      
      jobStorage.updateStage(
        jobId,
        'transcribing',
        'completed',
        srtPath
      );

      logger.info('Transcription stage completed', {
        jobId,
        srtPath,
        segmentCount: transcriptSegments.length,
      });
    } catch (error) {
      return handleStageError(jobId, 'transcribing', error);
    }

    // Stage 3: Store Transcript - Save to Google Sheets
    logger.info('Starting Store Transcript stage', { jobId });
    jobStorage.updateStage(jobId, 'storing-transcript', 'in-progress');
    
    try {
      const sheetsService = new SheetsStorageService();
      await sheetsService.initialize();
      
      const sheetRange = await sheetsService.saveTranscript(jobId, transcriptSegments);
      
      jobStorage.updateStage(
        jobId,
        'storing-transcript',
        'completed',
        sheetRange
      );

      logger.info('Store Transcript stage completed', {
        jobId,
        sheetRange,
      });
    } catch (error) {
      return handleStageError(jobId, 'storing-transcript', error);
    }

    // Stage 4: Highlight Detection - Identify key moments
    logger.info('Starting Highlight Detection stage', { jobId });
    jobStorage.updateStage(jobId, 'detecting-highlights', 'in-progress');
    
    let highlights: any[];
    try {
      const highlightService = new HighlightDetectionService();
      highlights = await highlightService.detectHighlights(srtPath);
      
      jobStorage.updateStage(
        jobId,
        'detecting-highlights',
        'completed',
        JSON.stringify({ highlightCount: highlights.length })
      );

      logger.info('Highlight Detection stage completed', {
        jobId,
        highlightCount: highlights.length,
      });
    } catch (error) {
      return handleStageError(jobId, 'detecting-highlights', error);
    }

    // Stage 5: Generate Editing Plan - Use LLM to create plan
    logger.info('Starting Generate Editing Plan stage', { jobId });
    jobStorage.updateStage(jobId, 'generating-plan', 'in-progress');
    
    let editingPlan: any;
    let videoDuration: number;
    try {
      const editingPlanService = new EditingPlanService();
      
      // Get video duration from transcript
      videoDuration = transcriptSegments.length > 0 
        ? Math.max(...transcriptSegments.map((s: any) => s.end))
        : 0;
      
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
      
      jobStorage.updateStage(
        jobId,
        'generating-plan',
        'completed',
        planPath
      );

      logger.info('Generate Editing Plan stage completed', {
        jobId,
        planPath,
        animations: editingPlan.animations.length,
        brollPlacements: editingPlan.brollPlacements.length,
      });
    } catch (error) {
      return handleStageError(jobId, 'generating-plan', error);
    }

    // Stage 6: Download B-roll - Get supplementary footage
    logger.info('Starting B-roll Download stage', { jobId });
    
    let brollVideos: any[] = [];
    try {
      if (editingPlan.brollPlacements && editingPlan.brollPlacements.length > 0) {
        const searchTerms = editingPlan.brollPlacements.map((b: any) => b.searchTerm);
        
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
          
          logger.info('B-roll downloaded successfully', {
            jobId,
            brollCount: brollVideos.length,
          });
        } catch (brollError) {
          // Handle missing B-roll gracefully
          logger.warn('B-roll download failed, continuing without B-roll', {
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
              
              logger.info('Fallback B-roll downloaded', {
                jobId,
                brollCount: brollVideos.length,
              });
            }
          } catch (fallbackError) {
            logger.warn('Fallback B-roll also failed, proceeding without B-roll', {
              jobId,
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            });
          }
        }
      }
    } catch (error) {
      // B-roll is optional, log but don't fail
      logger.warn('B-roll stage encountered error, continuing', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Stage 7: Rendering - Apply animations and effects
    logger.info('Starting Rendering stage', { jobId });
    jobStorage.updateStage(jobId, 'rendering', 'in-progress');
    
    let finalVideoPath: string;
    try {
      const outputPath = path.join(
        path.dirname(autoEditedVideoPath),
        `${jobId}_final.mp4`
      );
      
      const renderResult = await remotionRenderingService.renderVideo({
        videoPath: autoEditedVideoPath,
        editingPlan,
        outputPath,
        srtPath,
        brollVideos,
      });
      
      finalVideoPath = renderResult.outputPath;
      
      jobStorage.updateStage(
        jobId,
        'rendering',
        'completed',
        finalVideoPath
      );

      logger.info('Rendering stage completed', {
        jobId,
        outputPath: finalVideoPath,
        fileSize: renderResult.fileSize,
      });
    } catch (error) {
      return handleStageError(jobId, 'rendering', error);
    }

    // Stage 8: YouTube Upload - Upload final video
    logger.info('Starting YouTube Upload stage', { jobId });
    jobStorage.updateStage(jobId, 'uploading', 'in-progress');
    
    let youtubeUrl: string;
    try {
      const youtubeService = new YouTubeUploadService();
      
      // TODO: Get OAuth credentials from config or user
      // For now, this will fail if credentials are not set
      // In production, credentials should be managed separately
      
      const uploadResult = await youtubeService.upload(
        finalVideoPath,
        {
          title: `Automated Video - ${jobId}`,
          description: 'Automatically edited and uploaded video',
          privacyStatus: 'private',
        },
        (progress) => {
          logger.debug('Upload progress', {
            jobId,
            percentage: progress.percentage,
          });
        }
      );
      
      youtubeUrl = uploadResult.url;
      
      jobStorage.updateStage(
        jobId,
        'uploading',
        'completed',
        youtubeUrl
      );

      logger.info('YouTube Upload stage completed', {
        jobId,
        youtubeUrl,
      });
    } catch (error) {
      return handleStageError(jobId, 'uploading', error);
    }

    // Mark job as completed
    jobStorage.updateStage(jobId, 'completed', 'completed');
    jobStorage.updateJobStatus(jobId, 'completed');

    logger.info('Video processing pipeline completed successfully', {
      jobId,
      youtubeUrl,
    });

    return {
      jobId,
      youtubeUrl,
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
    const job = jobStorage.getJob(jobId);
    if (job) {
      const currentStage = getCurrentStage(job);
      jobStorage.setJobError(jobId, currentStage, errorMessage, errorStack);
      jobStorage.updateJobStatus(jobId, 'failed');
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
export function getStatus(jobId: string): JobStatus {
  const job = jobStorage.getJob(jobId);
  
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
