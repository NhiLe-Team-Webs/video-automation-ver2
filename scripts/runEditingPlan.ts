#!/usr/bin/env tsx
/**
 * Run Editing Plan Generation Step
 * 
 * Executes only the editing plan generation step of the pipeline
 * Usage: npm run pipeline:editing-plan -- --srt <path> --duration <seconds>
 */

import { createLogger } from '../src/utils/logger';
import { EditingPlanService } from '../src/services/content-analysis/editingPlanService';
import { HighlightDetectionService } from '../src/services/content-analysis/highlightDetectionService';
import { TranscriptionService } from '../src/services/transcription/transcriptionService';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('EditingPlanStep');

async function runEditingPlan(srtPath: string, videoDuration: number, outputPath?: string) {
  logger.info('Starting editing plan generation step', { srtPath, videoDuration });

  try {
    // Parse SRT file
    const transcriptionService = new TranscriptionService();
    const content = await fs.readFile(srtPath, 'utf-8');
    const segments = await transcriptionService['parseSRT'](content);

    // Detect highlights
    const highlightService = new HighlightDetectionService();
    const highlights = await highlightService.detectHighlights(srtPath);

    // Generate editing plan
    const editingPlanService = new EditingPlanService();
    const editingPlan = await editingPlanService.generatePlan({
      transcript: segments,
      highlights,
      videoDuration,
    });

    // Save to file if output path provided
    if (outputPath) {
      await editingPlanService.savePlanToFile(editingPlan, outputPath);
    }

    logger.info('Editing plan generated', {
      highlights: editingPlan.highlights.length,
      animations: editingPlan.animations.length,
      transitions: editingPlan.transitions.length,
      brollPlacements: editingPlan.brollPlacements.length,
      zoomEffects: editingPlan.zoomEffects?.length || 0,
    });
    
    console.log(`\n✅ Editing plan generated!`);
    console.log(`📊 Plan summary:`);
    console.log(`   - Highlight effects: ${editingPlan.highlights.length}`);
    console.log(`   - Animations: ${editingPlan.animations.length}`);
    console.log(`   - Transitions: ${editingPlan.transitions.length}`);
    console.log(`   - B-roll placements: ${editingPlan.brollPlacements.length}`);
    console.log(`   - Zoom effects: ${editingPlan.zoomEffects?.length || 0}`);
    
    if (outputPath) {
      console.log(`\n📁 Plan saved to: ${outputPath}`);
    }
    console.log();

  } catch (error) {
    logger.error('Editing plan generation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Editing plan generation failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const srtIndex = args.indexOf('--srt');
const durationIndex = args.indexOf('--duration');

if (srtIndex === -1 || durationIndex === -1) {
  console.error('Usage: npm run pipeline:editing-plan -- --srt <path> --duration <seconds> [--output <path>]');
  process.exit(1);
}

const srtPath = args[srtIndex + 1];
const videoDuration = parseFloat(args[durationIndex + 1]);
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

runEditingPlan(srtPath, videoDuration, outputPath);
