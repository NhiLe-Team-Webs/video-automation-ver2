import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TranscriptionService, TranscriptSegment } from './transcriptionService';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

/**
 * Feature: youtube-video-automation, Property 7: SRT file validity
 * 
 * Property: For any transcription output, the generated SRT file should be valid 
 * (proper format with sequential numbering, timestamp format HH:MM:SS,mmm --> HH:MM:SS,mmm, 
 * and non-empty text).
 * 
 * Validates: Requirements 3.2
 */
describe('TranscriptionService - Property-Based Tests', () => {
  let service: TranscriptionService;
  const testDir = path.join(config.storage.tempDir, 'test-transcription-pbt');

  beforeEach(async () => {
    service = new TranscriptionService();
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Feature: youtube-video-automation, Property 7: SRT file validity
   */
  it('Property 7: generated SRT files should always be valid for any transcript segments', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary transcript segments
        fc.array(
          fc.record({
            start: fc.double({ min: 0, max: 3600, noNaN: true, noDefaultInfinity: true }),
            end: fc.double({ min: 0, max: 3600, noNaN: true, noDefaultInfinity: true }),
            text: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          }),
          { minLength: 1, maxLength: 50 }
        ).map(segments => {
          // Ensure start < end for each segment and sort by start time
          return segments
            .map(seg => ({
              start: Math.min(seg.start, seg.end),
              end: Math.max(seg.start, seg.end),
              text: seg.text.trim(),
            }))
            .filter(seg => seg.start < seg.end) // Remove segments where start === end
            .sort((a, b) => a.start - b.start);
        }).filter(segments => segments.length > 0), // Ensure we have at least one valid segment
        async (segments: TranscriptSegment[]) => {
          const srtPath = path.join(testDir, `test-${Date.now()}-${Math.random()}.srt`);
          
          // Generate SRT file using the service
          await (service as any).writeSRT(srtPath, segments);

          // Read the generated file
          const content = await fs.readFile(srtPath, 'utf-8');

          // Property 1: File should not be empty
          expect(content.trim()).not.toBe('');

          // Property 2: File should contain subtitle blocks
          const blocks = content.trim().split(/\n\s*\n/);
          expect(blocks.length).toBeGreaterThan(0);
          expect(blocks.length).toBe(segments.length);

          // Property 3: Each block should have valid structure
          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i].trim();
            const lines = block.split('\n');

            // Should have at least 3 lines (sequence, timestamp, text)
            expect(lines.length).toBeGreaterThanOrEqual(3);

            // Line 1: Sequential numbering starting from 1
            const sequenceNum = parseInt(lines[0], 10);
            expect(sequenceNum).toBe(i + 1);
            expect(isNaN(sequenceNum)).toBe(false);

            // Line 2: Timestamp format HH:MM:SS,mmm --> HH:MM:SS,mmm
            const timestampPattern = /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/;
            expect(lines[1]).toMatch(timestampPattern);

            // Line 3+: Non-empty text
            const text = lines.slice(2).join(' ').trim();
            expect(text.length).toBeGreaterThan(0);
          }

          // Property 4: Validation should pass
          await expect((service as any).validateSRT(srtPath)).resolves.not.toThrow();

          // Property 5: Round-trip should preserve data
          const parsedSegments = await (service as any).parseSRT(srtPath);
          expect(parsedSegments.length).toBe(segments.length);

          // Verify each segment round-trips correctly
          for (let i = 0; i < segments.length; i++) {
            const original = segments[i];
            const parsed = parsedSegments[i];

            // Timestamps should be preserved (with small tolerance for rounding)
            expect(Math.abs(parsed.start - original.start)).toBeLessThan(0.001);
            expect(Math.abs(parsed.end - original.end)).toBeLessThan(0.001);

            // Text should be preserved
            expect(parsed.text).toBe(original.text);
          }

          // Cleanup
          await fs.unlink(srtPath).catch(() => {});
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in the design document
    );
  });
});
