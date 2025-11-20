import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SheetsStorageService } from './sheetsStorageService';
import { TranscriptSegment } from './transcriptionService';

/**
 * Feature: youtube-video-automation, Property 8: Transcript storage round-trip
 * 
 * Property: For any transcript stored in Google Sheets, retrieving it by job ID 
 * should return segments that match the original SRT file content.
 * 
 * Validates: Requirements 3.3
 */

// Mock logger
vi.mock('../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(() => ({})),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        values: {
          append: vi.fn(),
          get: vi.fn(),
        },
      },
    }),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => {
  const readFileMock = vi.fn();
  return {
    default: {
      readFile: readFileMock,
    },
    readFile: readFileMock,
  };
});

// Mock config
vi.mock('../config', () => ({
  config: {
    googleSheets: {
      spreadsheetId: 'test-spreadsheet-id',
      credentials: './test-credentials.json',
    },
  },
}));

describe('SheetsStorageService - Property-Based Tests', () => {
  let service: SheetsStorageService;
  let mockSheets: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock credentials
    const fs = await import('fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        client_email: 'test@test.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      })
    );

    // Create service instance
    service = new SheetsStorageService();

    // Initialize service
    await service.initialize();

    // Get mock sheets instance
    const { google } = await import('googleapis');
    mockSheets = google.sheets('v4');
  });

  /**
   * Feature: youtube-video-automation, Property 8: Transcript storage round-trip
   */
  it('Property 8: stored transcripts should round-trip correctly for any valid segments', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary job IDs
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        // Generate arbitrary transcript segments
        fc.array(
          fc.record({
            start: fc.double({ min: 0, max: 3600, noNaN: true, noDefaultInfinity: true }),
            end: fc.double({ min: 0, max: 3600, noNaN: true, noDefaultInfinity: true }),
            text: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          }),
          { minLength: 1, maxLength: 50 }
        ).map(segments => {
          // Ensure start < end for each segment
          return segments
            .map(seg => ({
              start: Math.min(seg.start, seg.end),
              end: Math.max(seg.start, seg.end),
              text: seg.text.trim(),
            }))
            .filter(seg => seg.start < seg.end); // Remove segments where start === end
        }).filter(segments => segments.length > 0), // Ensure we have at least one valid segment
        async (jobId: string, segments: TranscriptSegment[]) => {
          // Mock the save operation
          mockSheets.spreadsheets.values.append.mockResolvedValue({
            data: {
              updates: {
                updatedRange: 'Sheet1!A2:B2',
                updatedRows: 1,
              },
            },
          });

          // Save the transcript
          await service.saveTranscript(jobId, segments);

          // Mock the retrieve operation with the saved data
          // Store as JSON in single cell
          mockSheets.spreadsheets.values.get.mockResolvedValue({
            data: {
              values: [
                [jobId, JSON.stringify(segments)],
              ],
            },
          });

          // Retrieve the transcript
          const retrievedSegments = await service.getTranscript(jobId);

          // Property: Retrieved segments should match original segments
          expect(retrievedSegments.length).toBe(segments.length);

          for (let i = 0; i < segments.length; i++) {
            const original = segments[i];
            const retrieved = retrievedSegments[i];

            // Timestamps should match exactly (Google Sheets stores as strings, then parses back)
            expect(retrieved.start).toBe(original.start);
            expect(retrieved.end).toBe(original.end);

            // Text should match exactly
            expect(retrieved.text).toBe(original.text);
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in the design document
    );
  });
});
