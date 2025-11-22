#!/usr/bin/env tsx
/**
 * Run YouTube Upload Step
 * 
 * Executes only the YouTube upload step of the pipeline
 * Usage: npm run pipeline:upload -- --video <path> --title <title>
 */

import { createLogger } from '../src/utils/logger';
import { YouTubeUploadService } from '../src/services/youtube/youtubeUploadService';

const logger = createLogger('YouTubeUploadStep');

async function runYoutubeUpload(videoPath: string, title: string, description?: string) {
  logger.info('Starting YouTube upload step', { videoPath, title });

  try {
    const youtubeService = new YouTubeUploadService();
    const result = await youtubeService.upload(videoPath, {
      title,
      description: description || 'Automatically edited video',
    });

    logger.info('YouTube upload completed', { 
      videoId: result.videoId,
      url: result.url,
      status: result.status,
    });
    
    console.log(`\n✅ YouTube upload completed!`);
    console.log(`📺 Video ID: ${result.videoId}`);
    console.log(`🔗 URL: ${result.url}`);
    console.log(`📊 Status: ${result.status}\n`);

  } catch (error) {
    logger.error('YouTube upload failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ YouTube upload failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const videoIndex = args.indexOf('--video');
const titleIndex = args.indexOf('--title');

if (videoIndex === -1 || titleIndex === -1) {
  console.error('Usage: npm run pipeline:upload -- --video <path> --title <title> [--description <desc>]');
  process.exit(1);
}

const videoPath = args[videoIndex + 1];
const title = args[titleIndex + 1];
const descIndex = args.indexOf('--description');
const description = descIndex !== -1 ? args[descIndex + 1] : undefined;

runYoutubeUpload(videoPath, title, description);
