import { PipelineStage } from '../utils/errors';
import { createLogger } from '../utils/logger';
import * as jobStorage from './jobStorage';
import { Job } from '../models/job';

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

    // TODO: Execute each pipeline stage
    // For now, this is a placeholder that will be implemented in later tasks
    // Each stage will:
    // 1. Mark stage as 'in-progress'
    // 2. Execute the stage logic
    // 3. Mark stage as 'completed' with output path
    // 4. Handle errors and mark as 'failed' if needed

    logger.info('Video processing pipeline initialized', {
      jobId,
      stages: PIPELINE_STAGES.length,
    });

    // Return processing result (will be updated when stages are implemented)
    return {
      jobId,
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

    // Update job with error
    const job = jobStorage.getJob(jobId);
    const currentStage = job ? getCurrentStage(job) : 'uploaded';
    
    jobStorage.setJobError(jobId, currentStage, errorMessage, errorStack);
    jobStorage.updateJobStatus(jobId, 'failed');

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
