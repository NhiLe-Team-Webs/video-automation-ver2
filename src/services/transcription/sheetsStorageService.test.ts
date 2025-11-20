import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SheetsStorageService } from './sheetsStorageService';
import { TranscriptSegment } from './transcriptionService';

// Mock logger
vi.mock('../../utils/logger', () => ({
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
vi.mock('../../config', () => ({
  config: {
    googleSheets: {
      spreadsheetId: 'test-spreadsheet-id',
      credentials: './test-credentials.json',
    },
  },
}));

describe('SheetsStorageService', () => {
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

  describe('saveTranscript', () => {
    it('should save transcript segments as JSON in a single cell', async () => {
      const jobId = 'test-job-123';
      const segments: TranscriptSegment[] = [
        { start: 0, end: 5, text: 'Hello world' },
        { start: 5, end: 10, text: 'This is a test' },
      ];

      mockSheets.spreadsheets.values.append.mockResolvedValue({
        data: {
          updates: {
            updatedRange: 'Sheet1!A2:B2',
            updatedRows: 1,
          },
        },
      });

      const result = await service.saveTranscript(jobId, segments);

      expect(result).toBe('Sheet1!A2:B2');
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Sheet1!A:B',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            ['test-job-123', JSON.stringify(segments)],
          ],
        },
      });
    });

    it('should reject segments with invalid timestamps (start >= end)', async () => {
      const jobId = 'test-job-123';
      const segments: TranscriptSegment[] = [
        { start: 10, end: 5, text: 'Invalid segment' },
      ];

      await expect(service.saveTranscript(jobId, segments)).rejects.toThrow(
        'start time (10) must be less than end time (5)'
      );
    });

    it('should reject segments with negative timestamps', async () => {
      const jobId = 'test-job-123';
      const segments: TranscriptSegment[] = [
        { start: -1, end: 5, text: 'Invalid segment' },
      ];

      await expect(service.saveTranscript(jobId, segments)).rejects.toThrow(
        'timestamps must be non-negative'
      );
    });

    it('should reject segments with empty text', async () => {
      const jobId = 'test-job-123';
      const segments: TranscriptSegment[] = [
        { start: 0, end: 5, text: '   ' },
      ];

      await expect(service.saveTranscript(jobId, segments)).rejects.toThrow(
        'text cannot be empty'
      );
    });
  });

  describe('getTranscript', () => {
    it('should retrieve transcript segments from JSON in single cell', async () => {
      const jobId = 'test-job-123';
      const segments = [
        { start: 0, end: 5, text: 'Hello world' },
        { start: 5, end: 10, text: 'This is a test' },
      ];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['test-job-123', JSON.stringify(segments)],
            ['other-job-456', JSON.stringify([{ start: 0, end: 3, text: 'Other job' }])],
          ],
        },
      });

      const retrieved = await service.getTranscript(jobId);

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0]).toEqual({
        start: 0,
        end: 5,
        text: 'Hello world',
      });
      expect(retrieved[1]).toEqual({
        start: 5,
        end: 10,
        text: 'This is a test',
      });
    });

    it('should return empty array when no data found', async () => {
      const jobId = 'test-job-123';

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [],
        },
      });

      const segments = await service.getTranscript(jobId);

      expect(segments).toEqual([]);
    });

    it('should return empty array when job ID not found', async () => {
      const jobId = 'test-job-123';

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['other-job-456', JSON.stringify([{ start: 0, end: 3, text: 'Other job' }])],
          ],
        },
      });

      const segments = await service.getTranscript(jobId);

      expect(segments).toEqual([]);
    });

    it('should skip rows with invalid JSON', async () => {
      const jobId = 'test-job-123';
      const validSegments = [{ start: 0, end: 5, text: 'Valid segment' }];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['test-job-123', 'invalid json'],
            ['test-job-123', JSON.stringify(validSegments)],
          ],
        },
      });

      const segments = await service.getTranscript(jobId);

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        start: 0,
        end: 5,
        text: 'Valid segment',
      });
    });
  });

  describe('round-trip', () => {
    it('should preserve data when saving and retrieving', async () => {
      const jobId = 'test-job-123';
      const originalSegments: TranscriptSegment[] = [
        { start: 0, end: 5.5, text: 'Hello world' },
        { start: 5.5, end: 10.25, text: 'This is a test' },
        { start: 10.25, end: 15, text: 'Final segment' },
      ];

      // Mock save
      mockSheets.spreadsheets.values.append.mockResolvedValue({
        data: {
          updates: {
            updatedRange: 'Sheet1!A2:B2',
            updatedRows: 1,
          },
        },
      });

      await service.saveTranscript(jobId, originalSegments);

      // Mock retrieve with the saved data
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['test-job-123', JSON.stringify(originalSegments)],
          ],
        },
      });

      const retrievedSegments = await service.getTranscript(jobId);

      expect(retrievedSegments).toEqual(originalSegments);
    });
  });
});
