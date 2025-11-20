/**
 * CSS Animations from Animate.css
 * 
 * Reference list of available CSS animations
 * Import 'animate.css' in your component to use these
 */

export const CSS_ANIMATIONS = {
  // Attention seekers
  attentionSeekers: [
    'bounce',
    'flash',
    'pulse',
    'rubberBand',
    'shakeX',
    'shakeY',
    'headShake',
    'swing',
    'tada',
    'wobble',
    'jello',
    'heartBeat'
  ],
  
  // Back entrances
  backEntrances: [
    'backInDown',
    'backInLeft',
    'backInRight',
    'backInUp'
  ],
  
  // Back exits
  backExits: [
    'backOutDown',
    'backOutLeft',
    'backOutRight',
    'backOutUp'
  ],
  
  // Bouncing entrances
  bouncingEntrances: [
    'bounceIn',
    'bounceInDown',
    'bounceInLeft',
    'bounceInRight',
    'bounceInUp'
  ],
  
  // Bouncing exits
  bouncingExits: [
    'bounceOut',
    'bounceOutDown',
    'bounceOutLeft',
    'bounceOutRight',
    'bounceOutUp'
  ],
  
  // Fading entrances
  fadingEntrances: [
    'fadeIn',
    'fadeInDown',
    'fadeInDownBig',
    'fadeInLeft',
    'fadeInLeftBig',
    'fadeInRight',
    'fadeInRightBig',
    'fadeInUp',
    'fadeInUpBig',
    'fadeInTopLeft',
    'fadeInTopRight',
    'fadeInBottomLeft',
    'fadeInBottomRight'
  ],
  
  // Fading exits
  fadingExits: [
    'fadeOut',
    'fadeOutDown',
    'fadeOutDownBig',
    'fadeOutLeft',
    'fadeOutLeftBig',
    'fadeOutRight',
    'fadeOutRightBig',
    'fadeOutUp',
    'fadeOutUpBig',
    'fadeOutTopLeft',
    'fadeOutTopRight',
    'fadeOutBottomRight',
    'fadeOutBottomLeft'
  ],
  
  // Flippers
  flippers: [
    'flip',
    'flipInX',
    'flipInY',
    'flipOutX',
    'flipOutY'
  ],
  
  // Lightspeed
  lightspeed: [
    'lightSpeedInRight',
    'lightSpeedInLeft',
    'lightSpeedOutRight',
    'lightSpeedOutLeft'
  ],
  
  // Rotating entrances
  rotatingEntrances: [
    'rotateIn',
    'rotateInDownLeft',
    'rotateInDownRight',
    'rotateInUpLeft',
    'rotateInUpRight'
  ],
  
  // Rotating exits
  rotatingExits: [
    'rotateOut',
    'rotateOutDownLeft',
    'rotateOutDownRight',
    'rotateOutUpLeft',
    'rotateOutUpRight'
  ],
  
  // Specials
  specials: [
    'hinge',
    'jackInTheBox',
    'rollIn',
    'rollOut'
  ],
  
  // Zooming entrances
  zoomingEntrances: [
    'zoomIn',
    'zoomInDown',
    'zoomInLeft',
    'zoomInRight',
    'zoomInUp'
  ],
  
  // Zooming exits
  zoomingExits: [
    'zoomOut',
    'zoomOutDown',
    'zoomOutLeft',
    'zoomOutRight',
    'zoomOutUp'
  ],
  
  // Sliding entrances
  slidingEntrances: [
    'slideInDown',
    'slideInLeft',
    'slideInRight',
    'slideInUp'
  ],
  
  // Sliding exits
  slidingExits: [
    'slideOutDown',
    'slideOutLeft',
    'slideOutRight',
    'slideOutUp'
  ]
} as const;

/**
 * Get all CSS animation names as flat array
 */
export function getAllCSSAnimations(): readonly string[] {
  return Object.values(CSS_ANIMATIONS).flat();
}

/**
 * Get CSS animations by category
 */
export function getCSSAnimationsByCategory(category: keyof typeof CSS_ANIMATIONS): readonly string[] {
  return CSS_ANIMATIONS[category];
}

/**
 * Generate CSS animation class name
 */
export function getAnimationClassName(animationName: string): string {
  return `animate__animated animate__${animationName}`;
}

/**
 * Generate CSS animation list for LLM prompt
 */
export function generateCSSAnimationListForLLM(): string {
  let output = 'Available CSS Animations (from Animate.css):\n\n';
  
  for (const [category, animations] of Object.entries(CSS_ANIMATIONS)) {
    output += `${category}:\n`;
    output += animations.map(anim => `  - ${anim}`).join('\n');
    output += '\n\n';
  }
  
  return output;
}
