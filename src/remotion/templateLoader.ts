/**
 * Template Loader
 * 
 * System for loading and managing Remotion animation templates
 */

import { AVAILABLE_TEMPLATES, TemplateName } from './templates';
import * as Templates from './templates';

export interface TemplateInfo {
  name: string;
  description: string;
  category: string;
  parameters: readonly string[];
}

export class TemplateLoader {
  /**
   * Get all available template names
   */
  static getAvailableTemplates(): TemplateName[] {
    return Object.keys(AVAILABLE_TEMPLATES) as TemplateName[];
  }

  /**
   * Get template metadata
   */
  static getTemplateInfo(templateName: TemplateName): TemplateInfo | null {
    const template = AVAILABLE_TEMPLATES[templateName];
    if (!template) {
      return null;
    }
    return template;
  }

  /**
   * Get all template metadata (for LLM prompt)
   */
  static getAllTemplateInfo(): Record<string, TemplateInfo> {
    return AVAILABLE_TEMPLATES;
  }

  /**
   * Validate if a template exists
   */
  static templateExists(templateName: string): boolean {
    return templateName in AVAILABLE_TEMPLATES;
  }

  /**
   * Get template component by name
   */
  static getTemplateComponent(templateName: TemplateName): React.ComponentType<any> | null {
    switch (templateName) {
      case 'animated-text':
        return Templates.AnimatedText;
      case 'bounce-text':
        return Templates.BounceText;
      case 'slide-text':
        return Templates.SlideText;
      case 'typewriter-subtitle':
        return Templates.TypewriterSubtitle;
      case 'pulsing-text':
        return Templates.PulsingText;
      case 'bubble-pop-text':
        return Templates.BubblePopText;
      case 'floating-bubble-text':
        return Templates.FloatingBubbleText;
      case 'glitch-text':
        return Templates.GlitchText;
      case 'card-flip':
        return Templates.CardFlip;
      case 'animated-list':
        return Templates.AnimatedList;
      case 'geometric-patterns':
        return Templates.GeometricPatterns;
      case 'liquid-wave':
        return Templates.LiquidWave;
      case 'matrix-rain':
        return Templates.MatrixRain;
      case 'particle-explosion':
        return Templates.ParticleExplosion;
      case 'sound-wave':
        return Templates.SoundWave;
      default:
        return null;
    }
  }

  /**
   * Generate template list for LLM prompt
   */
  static generateTemplateListForLLM(): string {
    const templates = this.getAllTemplateInfo();
    let output = 'Available Animation Templates:\n\n';
    
    for (const [key, info] of Object.entries(templates)) {
      output += `- ${key}: ${info.description}\n`;
      output += `  Category: ${info.category}\n`;
      output += `  Parameters: ${info.parameters.join(', ')}\n\n`;
    }
    
    return output;
  }
}
