/**
 * Brand Kit Service Example
 * 
 * Demonstrates how to use the brand kit service with Crown Mercado brand
 */

import { BrandKitService, VideoMetadata } from './brandKitService';
import { crownMercadoBrandKit, getBrandColors } from './brandConstantsAdapter';

async function main() {
  console.log('=== Brand Kit Service Example ===\n');

  // Example 1: Load brand kit from file
  console.log('1. Loading brand kit from file...');
  const service = new BrandKitService();
  const brandKit = await service.loadBrandKit();
  console.log('Brand Kit:', {
    name: brandKit.name,
    styleFamily: brandKit.animationPreferences.styleFamily,
    primaryColor: brandKit.colors.primary,
    preferredTemplates: brandKit.animationPreferences.preferredTemplates,
  });
  console.log('');

  // Example 2: Use Crown Mercado brand constants
  console.log('2. Using Crown Mercado brand constants...');
  const crownMercadoKit = crownMercadoBrandKit();
  console.log('Crown Mercado Brand:', {
    name: crownMercadoKit.name,
    primaryColor: crownMercadoKit.colors.primary,
    fontFamily: crownMercadoKit.typography.fontFamily,
  });
  console.log('');

  // Example 3: Generate style guide
  console.log('3. Generating style guide...');
  const videoMetadata: VideoMetadata = {
    duration: 120,
    resolution: { width: 1920, height: 1080 },
    format: 'mp4',
    aspectRatio: '16:9',
  };

  const styleGuide = await service.generateStyleGuide(videoMetadata);
  console.log('Style Guide:', {
    selectedTemplates: styleGuide.selectedTemplates,
    transitionType: styleGuide.transitionStyle.type,
    transitionDuration: styleGuide.transitionStyle.duration,
    colorScheme: styleGuide.colorScheme,
  });
  console.log('');

  // Example 4: Validate editing plan
  console.log('4. Validating editing plan...');
  const editingPlan = {
    animations: [
      {
        startTime: 5,
        duration: 3,
        template: 'animated-text',
        text: 'Crown Mercado',
        parameters: {},
      },
      {
        startTime: 10,
        duration: 3,
        template: 'geometric-patterns', // Crown Mercado's triangle motif
        parameters: {},
      },
    ],
    transitions: [
      { time: 8, type: 'fade' as const, duration: 400 },
      { time: 15, type: 'fade' as const, duration: 400 },
    ],
    textHighlights: [
      {
        text: 'Creating Brand Preference',
        startTime: 5,
        duration: 2,
        style: {
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 56,
          fontWeight: 700,
          color: '#FFFFFF',
          animation: 'fade-in' as const,
        },
      },
    ],
  };

  const validation = service.validateStyleConsistency(editingPlan, styleGuide);
  console.log('Validation Result:', {
    isConsistent: validation.isConsistent,
    violations: validation.violations.length,
  });

  if (validation.violations.length > 0) {
    console.log('Violations:');
    validation.violations.forEach((v) => {
      console.log(`  - ${v.element}: ${v.property} (${v.severity})`);
      console.log(`    Expected: ${v.expected}, Got: ${v.actual}`);
    });
  }
  console.log('');

  // Example 5: Apply style guide to elements
  console.log('5. Applying style guide to elements...');
  const textElement = {
    type: 'text' as const,
    properties: {
      text: 'Bold, Innovative, Visionary',
    },
  };

  const styledElement = service.applyStyleGuide(textElement, styleGuide);
  console.log('Styled Text Element:', {
    fontFamily: styledElement.properties.fontFamily,
    fontWeight: styledElement.properties.fontWeight,
    color: styledElement.properties.color,
  });
  console.log('');

  // Example 6: Get brand colors for templates
  console.log('6. Brand colors for use in templates...');
  const colors = getBrandColors();
  console.log('Crown Mercado Colors:', {
    primaryRed: colors.primaryRed,
    charcoal: colors.charcoal,
    white: colors.white,
  });
  console.log('');

  console.log('=== Example Complete ===');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main as runBrandKitExample };
