import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { ProcessingError } from '../utils/errors';

const logger = createLogger('AutoEditorService');

export interface AutoEditorOptions {
  margin: string;
  editMode: 'audio' | 'motion';
  threshold: number;
}

export interface AutoEditorResult {
  outputPath: string;
  inputDuration: number;
  outputDuration: number;
  inputResolution: { width: number; height: number };
  outputResolution: { width: number; height: number };
}

export class AutoEditorService {
  /**
   * Process video through Auto Editor to remove silence and filler content
   */
  async processVideo(
    inputPath: string,
    options?: Partial<AutoEditorOptions>
  ): Promise<AutoEditorResult> {
    const jobId = path.basename(inputPath, path.extname(inputPath));
    
    logger.info('Starting Auto Editor processing', {
      jobId,
      inputPath,
      options,
    });

    try {
      // Get input video metadata
      const inputMetadata = await this.getVideoMetadata(inputPath);
      const inputDuration = inputMetadata.duration;
      const inputResolution = inputMetadata.resolution;

      logger.info('Input video metadata', {
        jobId,
        duration: inputDuration,
        resolution: inputResolution,
      });

      // Generate output path
      const outputPath = this.generateOutputPath(inputPath);

      // Run Auto Editor
      await this.runAutoEditor(inputPath, outputPath, options);

      // Get output video metadata
      const outputMetadata = await this.getVideoMetadata(outputPath);
      const outputDuration = outputMetadata.duration;
      const outputResolution = outputMetadata.resolution;

      logger.info('Output video metadata', {
        jobId,
        duration: outputDuration,
        resolution: outputResolution,
      });

      // Verify output duration is shorter or equal
      if (outputDuration > inputDuration) {
        logger.warn('Output duration is longer than input duration', {
          jobId,
          inputDuration,
          outputDuration,
        });
      }

      // Verify resolution preservation
      if (
        outputResolution.width !== inputResolution.width ||
        outputResolution.height !== inputResolution.height
      ) {
        const errorMsg = `Resolution not preserved. Input: ${inputResolution.width}x${inputResolution.height}, Output: ${outputResolution.width}x${outputResolution.height}`;
        logger.error(errorMsg, { jobId });
        throw new ProcessingError(errorMsg, {
          jobId,
          stage: 'auto-editing',
          attemptNumber: 0,
        });
      }

      logger.info('Auto Editor processing completed successfully', {
        jobId,
        outputPath,
        durationReduction: inputDuration - outputDuration,
      });

      return {
        outputPath,
        inputDuration,
        outputDuration,
        inputResolution,
        outputResolution,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Auto Editor processing failed', {
        jobId,
        error: errorMessage,
        stack: errorStack,
      });

      throw new ProcessingError(
        `Auto Editor processing failed: ${errorMessage}`,
        {
          jobId,
          stage: 'auto-editing',
          attemptNumber: 0,
        }
      );
    }
  }

  /**
   * Run Auto Editor Python CLI
   */
  private async runAutoEditor(
    inputPath: string,
    outputPath: string,
    options?: Partial<AutoEditorOptions>
  ): Promise<void> {
    const margin = options?.margin || config.autoEditor.margin;
    const threshold = options?.threshold || config.autoEditor.threshold;
    const editMode = options?.editMode || 'audio';

    // Build Auto Editor command
    // Use python -m auto_editor for better Windows compatibility
    const args = [
      '-m', 'auto_editor',
      inputPath,
      '--output', outputPath,
      '--edit', `${editMode}:threshold=${threshold}`,
      '--margin', margin,
    ];

    logger.info('Running Auto Editor command', {
      command: 'python',
      args,
    });

    return new Promise((resolve, reject) => {
      const process = spawn('python', args);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        logger.debug('Auto Editor stdout', { output });
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        logger.debug('Auto Editor stderr', { output });
      });

      process.on('close', (code) => {
        if (code === 0) {
          logger.info('Auto Editor completed successfully');
          resolve();
        } else {
          const errorMsg = `Auto Editor exited with code ${code}. stderr: ${stderr}`;
          logger.error('Auto Editor failed', {
            exitCode: code,
            stdout,
            stderr,
          });
          reject(new Error(errorMsg));
        }
      });

      process.on('error', (error) => {
        logger.error('Failed to spawn Auto Editor process', {
          error: error.message,
        });
        reject(new Error(`Failed to spawn Auto Editor: ${error.message}`));
      });
    });
  }

  /**
   * Get video metadata using ffmpeg
   */
  private async getVideoMetadata(
    filePath: string
  ): Promise<{ duration: number; resolution: { width: number; height: number } }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === 'video'
        );

        if (!videoStream) {
          reject(new Error('No video stream found in file'));
          return;
        }

        const duration = metadata.format.duration || 0;
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;

        resolve({
          duration,
          resolution: { width, height },
        });
      });
    });
  }

  /**
   * Generate output path for processed video
   */
  private generateOutputPath(inputPath: string): string {
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const basename = path.basename(inputPath, ext);
    return path.join(dir, `${basename}_edited${ext}`);
  }

  /**
   * Check if output file exists
   */
  async outputExists(inputPath: string): Promise<boolean> {
    const outputPath = this.generateOutputPath(inputPath);
    try {
      await fs.access(outputPath);
      return true;
    } catch {
      return false;
    }
  }
}
