#!/usr/bin/env tsx
/**
 * Run Rendering Step
 * 
 * Executes only the rendering step of the pipeline
 * Usage: npm run pipeline:render -- --video <path> --plan <path> --output <path>
 */

import { createLogger } from '../src/utils/logger';
import remotionRenderingService from '../src/services/rendering/remotionRenderingService';
import { EditingPlan } from '../src/services/content-analysis/editingPlanService';
import fs from 'fs/promises';

const logger = createLogger('RenderingStep');

async function runRendering(videoPath: string, planPath: string, outputPath: string, srtPath?: string) {
  logger.info('Starting rendering step', { videoPath, planPath, outputPath });

  try {
    // Load editing plan
    const planContent = await fs.readFile(planPath, 'utf-8');
    const editingPlan: EditingPlan = JSON.parse(planContent);

    // Render video
    const result = await remotionRenderingService.renderVideo({
      videoPath,
      editingPlan,
      outputPath,
      srtPath,
      brollVideos: [],
    });

    logger.info('Rendering completed', { 
      outputPath: result.outputPath,
      duration: result.duration,
      fileSize: result.fileSize,
    });
    
    console.log(`\n✅ Rendering completed!`);
    console.log(`📁 Output: ${result.outputPath}`);
    console.log(`⏱️  Duration: ${result.duration.toFixed(2)}s`);
    console.log(`💾 File size: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB\n`);

  } catch (error) {
    logger.error('Rendering failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Rendering failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const videoIndex = args.indexOf('--video');
const planIndex = args.indexOf('--plan');
const outputIndex = args.indexOf('--output');

if (videoIndex === -1 || planIndex === -1 || outputIndex === -1) {
  console.error('Usage: npm run pipeline:render -- --video <path> --plan <path> --output <path> [--srt <path>]');
  process.exit(1);
}

const videoPath = args[videoIndex + 1];
const planPath = args[planIndex + 1];
const outputPath = args[outputIndex + 1];
const srtIndex = args.indexOf('--srt');
const srtPath = srtIndex !== -1 ? args[srtIndex + 1] : undefined;

runRendering(videoPath, planPath, outputPath, srtPath);
