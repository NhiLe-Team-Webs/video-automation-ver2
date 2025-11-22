/**
 * Remotion Module
 * 
 * Main entry point for Remotion rendering infrastructure
 */

// Configuration
export * from './config';

// Templates
export * from './templates';
export * from './templateLoader';

// Animations
export * from './animations/css-animations';

// Transitions
export * from './transitions';

// Composition
export * from './VideoComposition';

// Register the root component for Remotion
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);

// Helper function to generate complete resource list for LLM
import { TemplateLoader } from './templateLoader';
import { generateCSSAnimationListForLLM } from './animations/css-animations';
import { generateTransitionListForLLM } from './transitions';

/**
 * Generate complete list of available resources for LLM prompt
 * This will be used when generating editing plans
 */
export function generateResourceListForLLM(): string {
  let output = '# Available Remotion Resources\n\n';
  
  output += '## Animation Templates\n\n';
  output += TemplateLoader.generateTemplateListForLLM();
  output += '\n';
  
  output += '## CSS Animations\n\n';
  output += generateCSSAnimationListForLLM();
  output += '\n';
  
  output += '## Transitions\n\n';
  output += generateTransitionListForLLM();
  
  return output;
}
