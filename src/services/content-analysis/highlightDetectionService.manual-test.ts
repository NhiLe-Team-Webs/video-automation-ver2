/**
 * Manual test script for Highlight Detection Service
 * 
 * Usage:
 * npx tsx src/services/highlightDetectionService.manual-test.ts
 */

import path from 'path';
import { HighlightDetectionService } from '../content-analysis/highlightDetectionService';

async function testHighlightDetection() {
  console.log('=== Highlight Detection Service Manual Test ===\n');

  const service = new HighlightDetectionService();

  // Test with the existing SRT file
  const srtPath = path.join(process.cwd(), 'temp', 'test-video_edited.srt');

  try {
    console.log(`Testing with SRT file: ${srtPath}\n`);

    const highlights = await service.detectHighlights(srtPath);

    console.log(`\n✅ Highlight Detection Completed!`);
    console.log(`Found ${highlights.length} highlights:\n`);

    if (highlights.length === 0) {
      console.log('No highlights detected. This is normal if the content is neutral.');
    } else {
      highlights.forEach((highlight, index) => {
        console.log(`Highlight ${index + 1}:`);
        console.log(`  Time: ${highlight.startTime.toFixed(2)}s - ${highlight.endTime.toFixed(2)}s`);
        console.log(`  Duration: ${(highlight.endTime - highlight.startTime).toFixed(2)}s`);
        console.log(`  Confidence: ${(highlight.confidence * 100).toFixed(1)}%`);
        console.log(`  Reason: ${highlight.reason}`);
        console.log('');
      });
    }

    // Summary statistics
    if (highlights.length > 0) {
      const totalDuration = highlights.reduce((sum, h) => sum + (h.endTime - h.startTime), 0);
      const avgConfidence = highlights.reduce((sum, h) => sum + h.confidence, 0) / highlights.length;

      console.log('Summary:');
      console.log(`  Total highlight duration: ${totalDuration.toFixed(2)}s`);
      console.log(`  Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`  Highest confidence: ${(Math.max(...highlights.map(h => h.confidence)) * 100).toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testHighlightDetection()
  .then(() => {
    console.log('\n✅ Manual test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Manual test failed:', error);
    process.exit(1);
  });
