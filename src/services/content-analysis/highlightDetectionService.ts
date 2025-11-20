import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../utils/logger';
import { ProcessingError } from '../../utils/errors';

const logger = createLogger('HighlightDetectionService');

export interface Highlight {
  startTime: number;
  endTime: number;
  confidence: number;
  reason: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Highlight Detection Service
 * 
 * Wraps videogrep CLI to detect highlights in video transcripts.
 * Uses videogrep's --search and --ngrams features.
 */
export class HighlightDetectionService {
  // Default search terms (simple keywords only, as per videogrep)
  private readonly defaultSearchTerms = [
    'important',
    'critical',
    'key',
    'breakthrough',
    'amazing',
    'best',
    'worst',
    'problem',
    'solution',
  ];

  /**
   * Run videogrep command with --search and --demo flags
   */
  private async runVideogrep(
    videoPath: string,
    searchTerms: string[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '--input',
        videoPath,
        '--demo', // Show results without making supercut
      ];

      // Add search terms (videogrep --search flag)
      for (const term of searchTerms) {
        args.push('--search', term);
      }

      logger.info('Running videogrep', {
        command: 'videogrep',
        args,
      });

      const process = spawn('videogrep', args);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`videogrep exited with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to spawn videogrep: ${error.message}`));
      });
    });
  }

  /**
   * Parse videogrep --demo output
   * Format: [start - end] text
   */
  private parseVideogrepOutput(output: string): Highlight[] {
    const highlights: Highlight[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/\[(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\]\s*(.+)/);

      if (match) {
        const startTime = parseFloat(match[1]);
        const endTime = parseFloat(match[2]);
        const text = match[3].trim();

        highlights.push({
          startTime,
          endTime,
          confidence: 1.0,
          reason: `matched: ${text.substring(0, 50)}...`,
        });
      }
    }

    return highlights;
  }

  /**
   * Detect highlights using videogrep --search with default terms
   */
  async detectHighlights(srtPath: string): Promise<Highlight[]> {
    const jobId = path.basename(srtPath, path.extname(srtPath));

    logger.info('Starting highlight detection with videogrep', {
      jobId,
      srtPath,
      searchTerms: this.defaultSearchTerms,
    });

    try {
      // videogrep requires video file (not just SRT)
      const videoPath = srtPath.replace(/\.srt$/, '.mp4');

      // Check if video file exists
      try {
        await fs.access(videoPath);
      } catch {
        logger.warn('Video file not found, using SRT-only fallback', {
          jobId,
          videoPath,
        });
        return await this.fallbackSRTSearch(srtPath, this.defaultSearchTerms);
      }

      // Run videogrep CLI
      const output = await this.runVideogrep(videoPath, this.defaultSearchTerms);

      // Parse output
      const highlights = this.parseVideogrepOutput(output);

      // Merge adjacent highlights (videogrep padding concept)
      const mergedHighlights = this.mergeAdjacentHighlights(highlights);

      // Validate
      const segments = await this.parseSRT(srtPath);
      const validatedHighlights = this.validateHighlights(
        mergedHighlights,
        segments
      );

      logger.info('Highlight detection completed', {
        jobId,
        highlightsFound: validatedHighlights.length,
      });

      return validatedHighlights;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Highlight detection failed', {
        jobId,
        error: errorMessage,
      });

      throw new ProcessingError(
        `Highlight detection failed: ${errorMessage}`,
        {
          jobId,
          stage: 'detecting-highlights',
          attemptNumber: 0,
        }
      );
    }
  }

  /**
   * Fallback: Simple keyword search in SRT (when video not available)
   */
  private async fallbackSRTSearch(
    srtPath: string,
    searchTerms: string[]
  ): Promise<Highlight[]> {
    const segments = await this.parseSRT(srtPath);

    if (segments.length === 0) {
      return [];
    }

    const highlights: Highlight[] = [];

    for (const segment of segments) {
      const text = segment.text.toLowerCase();
      const matched: string[] = [];

      for (const term of searchTerms) {
        if (text.includes(term.toLowerCase())) {
          matched.push(term);
        }
      }

      if (matched.length > 0) {
        highlights.push({
          startTime: segment.start,
          endTime: segment.end,
          confidence: 1.0,
          reason: `matched: ${matched.join(', ')}`,
        });
      }
    }

    const mergedHighlights = this.mergeAdjacentHighlights(highlights);
    return this.validateHighlights(mergedHighlights, segments);
  }

  /**
   * Search with custom terms using videogrep --search
   * Example: videogrep --input video.mp4 --search 'term1' --search 'term2' --demo
   */
  async searchHighlights(
    srtPath: string,
    searchTerms: (string | RegExp)[]
  ): Promise<Highlight[]> {
    const jobId = path.basename(srtPath, path.extname(srtPath));

    logger.info('Starting videogrep custom search', {
      jobId,
      srtPath,
      searchTerms: searchTerms.map((t) => t.toString()),
    });

    try {
      // videogrep only accepts strings, not regex
      const stringTerms = searchTerms.map((t) =>
        typeof t === 'string' ? t : t.source
      );

      const videoPath = srtPath.replace(/\.srt$/, '.mp4');

      try {
        await fs.access(videoPath);
      } catch {
        logger.warn('Video file not found, using SRT-only fallback', {
          jobId,
          videoPath,
        });
        return await this.fallbackSRTSearch(srtPath, stringTerms);
      }

      // Run videogrep
      const output = await this.runVideogrep(videoPath, stringTerms);

      // Parse and validate
      const highlights = this.parseVideogrepOutput(output);
      const mergedHighlights = this.mergeAdjacentHighlights(highlights);
      const segments = await this.parseSRT(srtPath);
      const validatedHighlights = this.validateHighlights(
        mergedHighlights,
        segments
      );

      logger.info('Custom search completed', {
        jobId,
        matchesFound: validatedHighlights.length,
      });

      return validatedHighlights;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Custom search failed', {
        jobId,
        error: errorMessage,
      });

      throw new ProcessingError(
        `Custom search failed: ${errorMessage}`,
        {
          jobId,
          stage: 'detecting-highlights',
          attemptNumber: 0,
        }
      );
    }
  }

  /**
   * Merge adjacent highlights (similar to videogrep --padding)
   * Merge clips within 2 seconds of each other
   */
  private mergeAdjacentHighlights(highlights: Highlight[]): Highlight[] {
    if (highlights.length === 0) {
      return [];
    }

    const sorted = [...highlights].sort((a, b) => a.startTime - b.startTime);
    const merged: Highlight[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // Merge if within 2 seconds (videogrep padding concept)
      if (next.startTime - current.endTime <= 2.0) {
        current.endTime = next.endTime;
        current.confidence = Math.max(current.confidence, next.confidence);
        current.reason += `; ${next.reason}`;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Validate highlights to ensure they have valid timestamps
   */
  private validateHighlights(
    highlights: Highlight[],
    segments: TranscriptSegment[]
  ): Highlight[] {
    if (segments.length === 0) {
      return [];
    }

    // Get video duration from last segment
    const videoDuration = Math.max(...segments.map(s => s.end));

    const validated = highlights.filter(highlight => {
      // Check that start < end
      if (highlight.startTime >= highlight.endTime) {
        logger.warn('Invalid highlight: start >= end', {
          startTime: highlight.startTime,
          endTime: highlight.endTime,
        });
        return false;
      }

      // Check that timestamps are within video duration
      if (highlight.startTime < 0 || highlight.endTime > videoDuration) {
        logger.warn('Invalid highlight: timestamps out of bounds', {
          startTime: highlight.startTime,
          endTime: highlight.endTime,
          videoDuration,
        });
        return false;
      }

      // Check that confidence is valid
      if (highlight.confidence < 0 || highlight.confidence > 1) {
        logger.warn('Invalid highlight: confidence out of range', {
          confidence: highlight.confidence,
        });
        return false;
      }

      return true;
    });

    logger.info('Highlight validation completed', {
      totalHighlights: highlights.length,
      validHighlights: validated.length,
      invalidHighlights: highlights.length - validated.length,
    });

    return validated;
  }

  /**
   * Parse SRT file to extract segments
   */
  private async parseSRT(srtPath: string): Promise<TranscriptSegment[]> {
    const content = await fs.readFile(srtPath, 'utf-8');
    const segments: TranscriptSegment[] = [];
    
    // Split by double newline to get each subtitle block
    const blocks = content.trim().split(/\n\s*\n/);
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      
      if (lines.length < 3) {
        continue; // Skip invalid blocks
      }
      
      // Line 0: sequence number (skip)
      // Line 1: timestamp
      // Line 2+: text
      
      const timestampLine = lines[1];
      const timestampMatch = timestampLine.match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
      );
      
      if (!timestampMatch) {
        logger.warn('Invalid timestamp format', { timestampLine });
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
   * Parse SRT timestamp to seconds
   */
  private parseSRTTimestamp(parts: string[]): number {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    const milliseconds = parseInt(parts[3], 10);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }
}
