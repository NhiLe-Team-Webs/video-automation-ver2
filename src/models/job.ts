import { PipelineStage } from '../utils/errors';

export interface VideoMetadata {
  duration: number;
  resolution: { width: number; height: number };
  format: string;
  fileSize: number;
  checksum: string;
}

export interface StageResult {
  stage: PipelineStage;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  outputPath?: string;
  error?: string;
}

export interface ErrorInfo {
  stage: PipelineStage;
  message: string;
  stack?: string;
  timestamp: Date;
}

export interface Job {
  id: string;
  userId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  videoMetadata: VideoMetadata;
  processingStages: StageResult[];
  finalYoutubeUrl?: string;
  error?: ErrorInfo;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  metadata?: VideoMetadata;
}

export interface UploadResult {
  jobId: string;
  videoPath: string;
  status: 'queued' | 'processing' | 'failed';
}
