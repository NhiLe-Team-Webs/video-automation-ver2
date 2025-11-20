/**
 * Example Usage of Remotion Infrastructure
 * 
 * This file demonstrates how to use the Remotion templates and utilities
 */

import { generateResourceListForLLM, TemplateLoader } from './index';

// Example 1: Get all available templates
console.log('=== Available Templates ===');
const templates = TemplateLoader.getAvailableTemplates();
console.log(templates);

// Example 2: Get template info
console.log('\n=== Template Info ===');
const animatedTextInfo = TemplateLoader.getTemplateInfo('animated-text');
console.log(animatedTextInfo);

// Example 3: Check if template exists
console.log('\n=== Template Validation ===');
console.log('animated-text exists:', TemplateLoader.templateExists('animated-text'));
console.log('fake-template exists:', TemplateLoader.templateExists('fake-template'));

// Example 4: Generate resource list for LLM
console.log('\n=== Resource List for LLM ===');
const resourceList = generateResourceListForLLM();
console.log(resourceList);

// Example 5: Get template component (for rendering)
console.log('\n=== Get Template Component ===');
const AnimatedTextComponent = TemplateLoader.getTemplateComponent('animated-text');
console.log('Component loaded:', AnimatedTextComponent !== null);

/**
 * Usage in LLM Service:
 * 
 * When generating editing plans, include the resource list in the prompt:
 * 
 * const prompt = `
 * Generate a video editing plan using the following resources:
 * 
 * ${generateResourceListForLLM()}
 * 
 * Video transcript: ${transcript}
 * Highlights: ${highlights}
 * 
 * Create an editing plan with appropriate animations and transitions.
 * `;
 */
