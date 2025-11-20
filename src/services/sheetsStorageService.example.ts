/**
 * Example usage of SheetsStorageService
 * 
 * This file demonstrates how to use the Google Sheets storage service
 * to save and retrieve transcript segments.
 */

import { SheetsStorageService } from './sheetsStorageService';
import { TranscriptSegment } from './transcriptionService';

async function exampleUsage() {
  // Create service instance
  const sheetsService = new SheetsStorageService();

  // Initialize the service (must be called before any operations)
  await sheetsService.initialize();

  // Example transcript segments
  const jobId = 'job-12345';
  const segments: TranscriptSegment[] = [
    {
      start: 0,
      end: 5.5,
      text: 'Hello and welcome to this video',
    },
    {
      start: 5.5,
      end: 12.3,
      text: 'Today we are going to talk about automated video editing',
    },
    {
      start: 12.3,
      end: 18.7,
      text: 'This system uses AI to create professional videos',
    },
  ];

  // Save transcript to Google Sheets
  console.log('Saving transcript...');
  const updatedRange = await sheetsService.saveTranscript(jobId, segments);
  console.log(`Transcript saved to: ${updatedRange}`);

  // Retrieve transcript from Google Sheets
  console.log('Retrieving transcript...');
  const retrievedSegments = await sheetsService.getTranscript(jobId);
  console.log(`Retrieved ${retrievedSegments.length} segments`);

  // Verify round-trip
  console.log('Verifying data integrity...');
  const isEqual = JSON.stringify(segments) === JSON.stringify(retrievedSegments);
  console.log(`Data integrity check: ${isEqual ? 'PASSED' : 'FAILED'}`);
}

// Run example (uncomment to test)
// exampleUsage().catch(console.error);
