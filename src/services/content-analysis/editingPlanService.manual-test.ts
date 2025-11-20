/**
 * Manual test for EditingPlanService
 * 
 * This script tests the editing plan service with real Gemini API calls
 * and saves the generated plan to a JSON file for inspection.
 * 
 * Prerequisites:
 * 1. Set GEMINI_API_KEY in your .env file
 * 2. Make sure you have a valid API key from Google AI Studio
 * 
 * To run:
 * npx tsx src/services/editingPlanService.manual-test.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { EditingPlanService } from './editingPlanService';
import type { EditingPlanInput } from './editingPlanService';

async function main() {
  console.log('=== EditingPlanService Manual Test ===\n');

  // Create output directory
  const outputDir = path.join(process.cwd(), 'temp', 'editing-plans');
  await fs.mkdir(outputDir, { recursive: true });

  // Create service instance
  const service = new EditingPlanService();

  // Test case 1: Short productivity video
  console.log('Test 1: Productivity Tips Video\n');
  const input1: EditingPlanInput = {
    transcript: [
      { start: 0, end: 3, text: 'Welcome to my productivity tips video' },
      { start: 3, end: 7, text: 'Today I will share three amazing techniques' },
      { start: 7, end: 12, text: 'First, the Pomodoro Technique helps you focus' },
      { start: 12, end: 16, text: 'Work for 25 minutes, then take a 5 minute break' },
      { start: 16, end: 20, text: 'Second, time blocking is a game changer' },
      { start: 20, end: 25, text: 'Schedule specific tasks in your calendar' },
      { start: 25, end: 30, text: 'Third, eliminate distractions from your workspace' },
      { start: 30, end: 35, text: 'Turn off notifications and close unnecessary tabs' },
      { start: 35, end: 40, text: 'These three tips will transform your productivity' },
      { start: 40, end: 43, text: 'Thanks for watching, see you next time' },
    ],
    highlights: [
      {
        startTime: 7,
        endTime: 12,
        confidence: 0.9,
        reason: 'Key technique mentioned: Pomodoro',
      },
      {
        startTime: 16,
        endTime: 20,
        confidence: 0.85,
        reason: 'Important concept: time blocking',
      },
      {
        startTime: 25,
        endTime: 30,
        confidence: 0.8,
        reason: 'Critical advice: eliminate distractions',
      },
    ],
    videoDuration: 43,
  };

  try {
    console.log('Generating editing plan...');
    const plan1 = await service.generatePlan(input1);
    
    // Save to file
    const outputPath1 = path.join(outputDir, 'plan-productivity-tips.json');
    await fs.writeFile(outputPath1, JSON.stringify(plan1, null, 2), 'utf-8');
    
    console.log('✓ Plan generated successfully!');
    console.log(`✓ Saved to: ${outputPath1}\n`);
    
    // Display summary
    console.log('Summary:');
    console.log(`- Highlight Effects: ${plan1.highlights.length}`);
    console.log(`- Animations: ${plan1.animations.length}`);
    console.log(`- Transitions: ${plan1.transitions.length}`);
    console.log(`- B-roll Placements: ${plan1.brollPlacements.length}\n`);
  } catch (error) {
    console.error('✗ Test 1 failed:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\n');
  }

  // Test case 2: Video with no highlights
  console.log('Test 2: Video with No Highlights\n');
  const input2: EditingPlanInput = {
    transcript: [
      { start: 0, end: 5, text: 'This is a simple video' },
      { start: 5, end: 10, text: 'With no special moments' },
      { start: 10, end: 15, text: 'Just regular content' },
    ],
    highlights: [], // No highlights
    videoDuration: 15,
  };

  try {
    console.log('Generating editing plan for video with no highlights...');
    const plan2 = await service.generatePlan(input2);
    
    // Save to file
    const outputPath2 = path.join(outputDir, 'plan-no-highlights.json');
    await fs.writeFile(outputPath2, JSON.stringify(plan2, null, 2), 'utf-8');
    
    console.log('✓ Plan generated successfully!');
    console.log(`✓ Saved to: ${outputPath2}\n`);
    
    // Display summary
    console.log('Summary:');
    console.log(`- Highlight Effects: ${plan2.highlights.length}`);
    console.log(`- Animations: ${plan2.animations.length}`);
    console.log(`- Transitions: ${plan2.transitions.length}`);
    console.log(`- B-roll Placements: ${plan2.brollPlacements.length}\n`);
  } catch (error) {
    console.error('✗ Test 2 failed:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\n');
  }

  // Test case 3: Longer video with multiple sections
  console.log('Test 3: Tutorial Video with Multiple Sections\n');
  const input3: EditingPlanInput = {
    transcript: [
      { start: 0, end: 5, text: 'Welcome to this coding tutorial' },
      { start: 5, end: 10, text: 'Today we will build a REST API' },
      { start: 10, end: 20, text: 'First, let me show you the project structure' },
      { start: 20, end: 30, text: 'We will use Node.js and Express' },
      { start: 30, end: 40, text: 'Now let me create the server file' },
      { start: 40, end: 50, text: 'Here is how you set up the routes' },
      { start: 50, end: 60, text: 'This is the most important part' },
      { start: 60, end: 70, text: 'Let me add error handling' },
      { start: 70, end: 80, text: 'Finally, we test the API' },
      { start: 80, end: 90, text: 'And that is how you build a REST API' },
    ],
    highlights: [
      {
        startTime: 10,
        endTime: 20,
        confidence: 0.7,
        reason: 'Project structure explanation',
      },
      {
        startTime: 50,
        endTime: 60,
        confidence: 0.95,
        reason: 'Most important part mentioned',
      },
      {
        startTime: 70,
        endTime: 80,
        confidence: 0.8,
        reason: 'Error handling section',
      },
    ],
    videoDuration: 90,
  };

  try {
    console.log('Generating editing plan for tutorial video...');
    const plan3 = await service.generatePlan(input3);
    
    // Save to file
    const outputPath3 = path.join(outputDir, 'plan-tutorial.json');
    await fs.writeFile(outputPath3, JSON.stringify(plan3, null, 2), 'utf-8');
    
    console.log('✓ Plan generated successfully!');
    console.log(`✓ Saved to: ${outputPath3}\n`);
    
    // Display summary
    console.log('Summary:');
    console.log(`- Highlight Effects: ${plan3.highlights.length}`);
    console.log(`- Animations: ${plan3.animations.length}`);
    console.log(`- Transitions: ${plan3.transitions.length}`);
    console.log(`- B-roll Placements: ${plan3.brollPlacements.length}\n`);
  } catch (error) {
    console.error('✗ Test 3 failed:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\n');
  }

  console.log('=== Manual Test Complete ===');
  console.log(`\nAll generated plans saved to: ${outputDir}`);
  console.log('\nYou can inspect the JSON files to see the editing plans.');
}

// Run the test
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
