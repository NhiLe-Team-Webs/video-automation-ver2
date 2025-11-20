import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import fs from 'fs/promises';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { ProcessingError } from '../utils/errors';
import { TranscriptSegment } from './transcriptionService';

const logger = createLogger('SheetsStorageService');

export class SheetsStorageService {
  private auth: JWT | null = null;
  private sheets: any = null;

  /**
   * Initialize Google Sheets API authentication
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Google Sheets API', {
        credentialsPath: config.googleSheets.credentials,
        spreadsheetId: config.googleSheets.spreadsheetId,
      });

      // Read credentials file
      const credentialsContent = await fs.readFile(
        config.googleSheets.credentials,
        'utf-8'
      );
      const credentials = JSON.parse(credentialsContent);

      // Create JWT client
      this.auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      // Initialize Sheets API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      logger.info('Google Sheets API initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize Google Sheets API', {
        error: errorMessage,
      });
      throw new Error(`Google Sheets initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.auth || !this.sheets) {
      throw new Error('SheetsStorageService not initialized. Call initialize() first.');
    }
  }

  /**
   * Save transcript segments to Google Sheets
   * Stores all segments as JSON in a single cell
   */
  async saveTranscript(jobId: string, segments: TranscriptSegment[]): Promise<string> {
    this.ensureInitialized();

    logger.info('Saving transcript to Google Sheets', {
      jobId,
      segmentCount: segments.length,
    });

    // Validate segments before saving
    this.validateSegments(segments);

    try {
      // Convert segments to JSON string for single cell storage
      const transcriptJson = JSON.stringify(segments);

      // Prepare data row: Job ID | Transcript JSON
      const row = [jobId, transcriptJson];

      // Append row to the spreadsheet
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: config.googleSheets.spreadsheetId,
        range: 'Sheet1!A:B', // Job ID in column A, Transcript in column B
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [row],
        },
      });

      logger.info('Transcript saved successfully', {
        jobId,
        updatedRange: response.data.updates.updatedRange,
        updatedRows: response.data.updates.updatedRows,
        transcriptSize: transcriptJson.length,
      });

      return response.data.updates.updatedRange;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to save transcript', {
        jobId,
        error: errorMessage,
      });
      throw new ProcessingError(
        `Failed to save transcript to Google Sheets: ${errorMessage}`,
        {
          jobId,
          stage: 'storing-transcript',
          attemptNumber: 0,
        }
      );
    }
  }

  /**
   * Retrieve transcript segments by job ID
   * Parses JSON from single cell storage
   */
  async getTranscript(jobId: string): Promise<TranscriptSegment[]> {
    this.ensureInitialized();

    logger.info('Retrieving transcript from Google Sheets', {
      jobId,
    });

    try {
      // Get all data from the sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.googleSheets.spreadsheetId,
        range: 'Sheet1!A:B', // Job ID in column A, Transcript in column B
      });

      const rows = response.data.values || [];

      if (rows.length === 0) {
        logger.warn('No data found in spreadsheet', { jobId });
        return [];
      }

      // Find row with matching job ID
      for (const row of rows) {
        // Skip if row doesn't have both columns
        if (row.length < 2) {
          continue;
        }

        const [rowJobId, transcriptJson] = row;

        // Filter by job ID
        if (rowJobId !== jobId) {
          continue;
        }

        // Parse JSON transcript
        try {
          const segments = JSON.parse(transcriptJson);

          // Validate it's an array
          if (!Array.isArray(segments)) {
            logger.warn('Transcript is not an array', { jobId });
            continue;
          }

          logger.info('Transcript retrieved successfully', {
            jobId,
            segmentCount: segments.length,
          });

          return segments;
        } catch (parseError) {
          logger.warn('Failed to parse transcript JSON', {
            jobId,
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
          continue;
        }
      }

      // No matching job ID found
      logger.warn('No transcript found for job ID', { jobId });
      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to retrieve transcript', {
        jobId,
        error: errorMessage,
      });
      throw new ProcessingError(
        `Failed to retrieve transcript from Google Sheets: ${errorMessage}`,
        {
          jobId,
          stage: 'storing-transcript',
          attemptNumber: 0,
        }
      );
    }
  }

  /**
   * Validate transcript segments
   * Validates Requirements 3.5: timestamp synchronization
   */
  private validateSegments(segments: TranscriptSegment[]): void {
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Validate start < end
      if (segment.start >= segment.end) {
        throw new Error(
          `Invalid segment ${i}: start time (${segment.start}) must be less than end time (${segment.end})`
        );
      }

      // Validate timestamps are non-negative
      if (segment.start < 0 || segment.end < 0) {
        throw new Error(
          `Invalid segment ${i}: timestamps must be non-negative (start: ${segment.start}, end: ${segment.end})`
        );
      }

      // Validate text is non-empty
      if (!segment.text || segment.text.trim().length === 0) {
        throw new Error(`Invalid segment ${i}: text cannot be empty`);
      }
    }

    logger.debug('Segment validation passed', {
      segmentCount: segments.length,
    });
  }
}
