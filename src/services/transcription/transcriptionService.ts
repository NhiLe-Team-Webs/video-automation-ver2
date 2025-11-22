import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';
import { ProcessingError } from '../../utils/errors';

const logger = createLogger('TranscriptionService');

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  srtPath: string;
  segments: TranscriptSegment[];
}

export class TranscriptionService {
  private openai?: OpenAI;

  constructor() {
    // Initialize OpenAI client if API key is provided
    if (config.whisper.apiKey && !config.whisper.useLocal) {
      this.openai = new OpenAI({
        apiKey: config.whisper.apiKey,
      });
    }
  }

  /**
   * Extract audio from video file
   */
  async extractAudio(videoPath: string): Promise<string> {
    const jobId = path.basename(videoPath, path.extname(videoPath));
    
    logger.info('Extracting audio from video', {
      jobId,
      videoPath,
    });

    const audioPath = this.generateAudioPath(videoPath);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .noVideo()
        .on('start', (commandLine) => {
          logger.debug('FFmpeg command', { commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('Audio extraction progress', {
            jobId,
            percent: progress.percent,
          });
        })
        .on('end', () => {
          logger.info('Audio extraction completed', {
            jobId,
            audioPath,
          });
          resolve(audioPath);
        })
        .on('error', (error) => {
          logger.error('Audio extraction failed', {
            jobId,
            error: error.message,
          });
          reject(new ProcessingError(
            `Audio extraction failed: ${error.message}`,
            {
              jobId,
              stage: 'transcribing',
              attemptNumber: 0,
            }
          ));
        })
        .run();
    });
  }

  /**
   * Transcribe audio file to text with timestamps
   */
  async transcribe(audioPath: string): Promise<TranscriptResult> {
    const jobId = path.basename(audioPath, path.extname(audioPath));
    
    logger.info('Starting transcription', {
      jobId,
      audioPath,
      useLocal: config.whisper.useLocal,
    });

    // Retry logic with exponential backoff
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info('Transcription attempt', {
          jobId,
          attempt,
          maxAttempts,
        });

        const result = config.whisper.useLocal
          ? await this.transcribeLocal(audioPath)
          : await this.transcribeAPI(audioPath);

        logger.info('Transcription completed successfully', {
          jobId,
          attempt,
          segmentCount: result.segments.length,
        });
        
        // Log sample transcript segments for visibility
        if (result.segments.length > 0) {
          logger.info('📝 Sample transcript:', {
            totalSegments: result.segments.length,
            samples: result.segments.slice(0, 3).map(s => ({
              time: `${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s`,
              text: s.text.substring(0, 80) + (s.text.length > 80 ? '...' : '')
            }))
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn('Transcription attempt failed', {
          jobId,
          attempt,
          maxAttempts,
          error: lastError.message,
        });

        // Don't wait after the last attempt
        if (attempt < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          logger.info('Waiting before retry', {
            jobId,
            delayMs,
          });
          await this.delay(delayMs);
        }
      }
    }

    // All attempts failed
    const errorMessage = `Transcription failed after ${maxAttempts} attempts: ${lastError?.message}`;
    logger.error('Transcription failed', {
      jobId,
      attempts: maxAttempts,
      error: lastError?.message,
    });

    throw new ProcessingError(errorMessage, {
      jobId,
      stage: 'transcribing',
      attemptNumber: maxAttempts,
    });
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  private async transcribeAPI(audioPath: string): Promise<TranscriptResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Please provide OPENAI_API_KEY.');
    }

    const jobId = path.basename(audioPath, path.extname(audioPath));

    logger.info('Transcribing with OpenAI Whisper API', {
      jobId,
      model: config.whisper.model,
    });

    // Read audio file
    const audioFile = await fs.readFile(audioPath);
    const audioBlob = new File([audioFile], path.basename(audioPath), {
      type: 'audio/mpeg',
    });

    // Call Whisper API with verbose_json to get timestamps
    const response = await this.openai.audio.transcriptions.create({
      file: audioBlob,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // Parse response to extract segments
    const segments: TranscriptSegment[] = [];
    
    if ('segments' in response && Array.isArray(response.segments)) {
      for (const segment of response.segments) {
        segments.push({
          start: segment.start,
          end: segment.end,
          text: segment.text.trim(),
        });
      }
    } else {
      // Fallback: create single segment if no segments provided
      segments.push({
        start: 0,
        end: 0,
        text: response.text,
      });
    }

    // Generate SRT file
    const srtPath = this.generateSRTPath(audioPath);
    await this.writeSRT(srtPath, segments);

    // Validate SRT file
    await this.validateSRT(srtPath);

    return {
      srtPath,
      segments,
    };
  }

  /**
   * Transcribe using local Whisper model
   */
  private async transcribeLocal(audioPath: string): Promise<TranscriptResult> {
    const jobId = path.basename(audioPath, path.extname(audioPath));

    logger.info('Transcribing with local Whisper', {
      jobId,
      model: config.whisper.model,
    });

    const srtPath = this.generateSRTPath(audioPath);

    // Run Whisper CLI with optimized parameters
    // whisper audio.mp3 --model base --output_format srt --output_dir ./ --language en --verbose False
    const outputDir = path.dirname(srtPath);
    const args = [
      '-m', 'whisper',
      audioPath,
      '--model', config.whisper.model,
      '--output_format', 'srt',
      '--output_dir', outputDir,
      '--language', 'en',  // Specify language to avoid detection overhead
      '--verbose', 'False', // Reduce verbose output
      '--word_timestamps', 'False', // Disable word timestamps for faster processing
    ];

    logger.info('Running Whisper command', {
      command: 'python',
      args,
    });

    // Set a timeout for the transcription process (30 minutes)
    const timeoutMs = 30 * 60 * 1000;

    await new Promise<void>((resolve, reject) => {
      const process = spawn('python', args);
      let timeoutId: NodeJS.Timeout;

      // Set up timeout
      timeoutId = setTimeout(() => {
        logger.warn('Whisper process timeout, killing process', { jobId });
        process.kill('SIGTERM');
        reject(new Error('Whisper transcription timed out after 30 minutes'));
      }, timeoutMs);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log progress information
        if (output.includes('%') || output.includes('segments')) {
          logger.info('Whisper progress', { jobId, output: output.trim() });
        } else {
          logger.debug('Whisper stdout', { output: output.trim() });
        }
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Log warnings but not debug info
        if (output.includes('Warning') || output.includes('Error')) {
          logger.warn('Whisper stderr', { jobId, output: output.trim() });
        } else {
          logger.debug('Whisper stderr', { output: output.trim() });
        }
      });

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          logger.info('Whisper completed successfully', { jobId });
          resolve();
        } else {
          const errorMsg = `Whisper exited with code ${code}. stderr: ${stderr}`;
          logger.error('Whisper failed', {
            jobId,
            exitCode: code,
            stdout,
            stderr,
          });
          reject(new Error(errorMsg));
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        logger.error('Failed to spawn Whisper process', {
          jobId,
          error: error.message,
        });
        reject(new Error(`Failed to spawn Whisper: ${error.message}`));
      });
    });

    // Parse SRT file to extract segments
    const segments = await this.parseSRT(srtPath);

    // Validate SRT file
    await this.validateSRT(srtPath);

    return {
      srtPath,
      segments,
    };
  }

  /**
   * Write segments to SRT file
   */
  private async writeSRT(srtPath: string, segments: TranscriptSegment[]): Promise<void> {
    const lines: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Sequence number
      lines.push(String(i + 1));
      
      // Timestamp line
      const startTime = this.formatSRTTimestamp(segment.start);
      const endTime = this.formatSRTTimestamp(segment.end);
      lines.push(`${startTime} --> ${endTime}`);
      
      // Text
      lines.push(segment.text);
      
      // Empty line between segments
      lines.push('');
    }

    await fs.writeFile(srtPath, lines.join('\n'), 'utf-8');
    
    logger.info('SRT file written', {
      srtPath,
      segmentCount: segments.length,
    });
  }

  /**
   * Parse SRT file to extract segments
   */
  private async parseSRT(srtPath: string): Promise<TranscriptSegment[]> {
    const content = await fs.readFile(srtPath, 'utf-8');
    const segments: TranscriptSegment[] = [];
    
    // Split by double newline to get each subtitle block (handle both \n and \r\n)
    const blocks = content.trim().split(/\r?\n\s*\r?\n/);
    
    for (const block of blocks) {
      const lines = block.trim().split(/\r?\n/);
      
      if (lines.length < 3) {
        continue; // Skip invalid blocks
      }
      
      // Line 0: sequence number (skip)
      // Line 1: timestamp
      // Line 2+: text
      
      const timestampLine = lines[1].trim(); // Remove any whitespace/carriage returns
      const timestampMatch = timestampLine.match(
        /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
      );
      
      if (!timestampMatch) {
        logger.warn('Invalid timestamp format', { timestampLine, block: block.substring(0, 100) });
        continue;
      }
      
      const startSeconds = this.parseSRTTimestamp(timestampMatch.slice(1, 5));
      const endSeconds = this.parseSRTTimestamp(timestampMatch.slice(5, 9));
      const text = lines.slice(2).join(' ').trim();
      
      segments.push({
        start: startSeconds,
        end: endSeconds,
        text,
      });
    }
    
    logger.info('SRT file parsed', {
      srtPath,
      segmentCount: segments.length,
    });
    
    return segments;
  }

  /**
   * Validate SRT file format
   */
  private async validateSRT(srtPath: string): Promise<void> {
    const content = await fs.readFile(srtPath, 'utf-8');
    
    // Check if file is empty
    if (!content.trim()) {
      throw new Error('SRT file is empty');
    }
    
    // Split by double newline to get each subtitle block
    const blocks = content.trim().split(/\n\s*\n/);
    
    if (blocks.length === 0) {
      throw new Error('SRT file contains no subtitle blocks');
    }
    
    // Validate each block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      const lines = block.split('\n');
      
      if (lines.length < 3) {
        throw new Error(`SRT block ${i + 1} has fewer than 3 lines`);
      }
      
      // Validate sequence number
      const sequenceNum = parseInt(lines[0], 10);
      if (isNaN(sequenceNum) || sequenceNum !== i + 1) {
        throw new Error(`SRT block ${i + 1} has invalid sequence number: ${lines[0]}`);
      }
      
      // Validate timestamp format
      const timestampPattern = /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/;
      if (!timestampPattern.test(lines[1])) {
        throw new Error(`SRT block ${i + 1} has invalid timestamp format: ${lines[1]}`);
      }
      
      // Validate text is non-empty
      const text = lines.slice(2).join(' ').trim();
      if (!text) {
        throw new Error(`SRT block ${i + 1} has empty text`);
      }
    }
    
    logger.info('SRT file validation passed', {
      srtPath,
      blockCount: blocks.length,
    });
  }

  /**
   * Format seconds to SRT timestamp (HH:MM:SS,mmm)
   */
  private formatSRTTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }

  /**
   * Parse SRT timestamp to seconds
   */
  private parseSRTTimestamp(parts: string[]): number {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    const milliseconds = parseInt(parts[3], 10);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  /**
   * Generate audio path from video path
   */
  private generateAudioPath(videoPath: string): string {
    const dir = path.dirname(videoPath);
    const basename = path.basename(videoPath, path.extname(videoPath));
    return path.join(dir, `${basename}.mp3`);
  }

  /**
   * Generate SRT path from audio path
   */
  private generateSRTPath(audioPath: string): string {
    const dir = path.dirname(audioPath);
    const basename = path.basename(audioPath, path.extname(audioPath));
    return path.join(dir, `${basename}.srt`);
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
