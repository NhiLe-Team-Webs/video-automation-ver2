/**
 * Remotion Transitions
 * 
 * Available transitions from remotion-transition-series
 */

export const AVAILABLE_TRANSITIONS = {
  'fade': {
    name: 'Fade',
    description: 'Simple fade transition between scenes',
    type: 'basic'
  },
  'dissolve': {
    name: 'Dissolve',
    description: 'Dissolve transition effect',
    type: 'basic'
  },
  'slide': {
    name: 'Slide',
    description: 'Slide transition (left, right, up, down)',
    type: 'directional',
    directions: ['left', 'right', 'up', 'down']
  },
  'wipe': {
    name: 'LinearWipe',
    description: 'Linear wipe transition',
    type: 'directional'
  },
  'circular-wipe': {
    name: 'CircularWipe',
    description: 'Circular wipe transition (in/out)',
    type: 'special',
    directions: ['in', 'out']
  },
  'sliding-doors': {
    name: 'SlidingDoors',
    description: 'Sliding doors transition effect',
    type: 'special'
  },
  'pan': {
    name: 'Pan',
    description: 'Pan transition between scenes',
    type: 'directional'
  }
} as const;

export type TransitionName = keyof typeof AVAILABLE_TRANSITIONS;

/**
 * Get all available transition names
 */
export function getAvailableTransitions(): TransitionName[] {
  return Object.keys(AVAILABLE_TRANSITIONS) as TransitionName[];
}

/**
 * Get transition info
 */
export function getTransitionInfo(transitionName: TransitionName) {
  return AVAILABLE_TRANSITIONS[transitionName];
}

/**
 * Generate transition list for LLM prompt
 */
export function generateTransitionListForLLM(): string {
  let output = 'Available Transitions (from remotion-transition-series):\n\n';
  
  for (const [key, info] of Object.entries(AVAILABLE_TRANSITIONS)) {
    output += `- ${key}: ${info.description}\n`;
    output += `  Type: ${info.type}\n`;
    if ('directions' in info) {
      output += `  Directions: ${info.directions.join(', ')}\n`;
    }
    output += '\n';
  }
  
  return output;
}
