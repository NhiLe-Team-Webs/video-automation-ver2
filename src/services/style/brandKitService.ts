/**
 * Brand Kit Service
 * 
 * Manages brand kit configuration and style guide generation
 * for consistent visual styling across video editing
 */

import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../utils/logger';
import { ProcessingError } from '../../utils/errors';

const logger = createLogger('BrandKitService');

// Brand Kit Schema
export interface BrandKit {
  name: string;
  version: string;
  colors: ColorScheme;
  typography: Typography;
  animationPreferences: AnimationPreferences;
  transitionPreferences: TransitionPreferences;
  effectPreferences: EffectPreferences;
}

export interface ColorScheme {
  primary: string; // hex color
  secondary: string;
  accent: string;
  textColor: string;
  backgroundColor: string;
}

export interface Typography {
  fontFamily: string;
  fontSize: {
    small: number;
    medium: number;
    large: number;
  };
  fontWeight: number;
  lineHeight: number;
}

export interface AnimationPreferences {
  styleFamily: 'modern' | 'minimal' | 'dynamic' | 'playful' | 'professional';
  preferredTemplates: string[]; // List of preferred template names
  timing: {
    textAppearDuration: number; // milliseconds
    textDisappearDuration: number;
    transitionDuration: number;
    zoomDuration: number;
  };
}

export interface TransitionPreferences {
  type: 'fade' | 'slide' | 'wipe';
  duration: number; // milliseconds (300-500ms)
  easing: string;
}

export interface EffectPreferences {
  intensity: {
    colorGrading: number; // 0.0 to 1.0
    contrast: number; // 0.8 to 1.3
    saturation: number; // 0.5 to 1.5
    sharpness: number; // 0.0 to 1.0
    vignette: number; // 0.1 to 0.15
  };
}

// Style Guide (generated from brand kit + video metadata)
export interface StyleGuide {
  brandKit: BrandKit;
  videoMetadata: VideoMetadata;
  colorScheme: ColorScheme;
  typography: Typography;
  animationTiming: AnimationTiming;
  transitionStyle: TransitionStyle;
  effectIntensity: EffectIntensity;
  selectedTemplates: string[]; // Specific templates to use for this video
}

export interface VideoMetadata {
  duration: number;
  resolution: { width: number; height: number };
  format: string;
  aspectRatio: string; // e.g., '16:9', '9:16'
}

export interface AnimationTiming {
  textAppearDuration: number;
  textDisappearDuration: number;
  transitionDuration: number;
  zoomDuration: number;
}

export interface TransitionStyle {
  type: 'fade' | 'slide' | 'wipe';
  duration: number;
  easing: string;
}

export interface EffectIntensity {
  colorGrading: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  vignette: number;
}

// Style Validation
export interface StyleValidation {
  isConsistent: boolean;
  violations: StyleViolation[];
}

export interface StyleViolation {
  element: string;
  property: string;
  expected: any;
  actual: any;
  severity: 'error' | 'warning';
}

// Visual Element (for validation)
export interface VisualElement {
  type: 'text' | 'animation' | 'transition' | 'effect';
  properties: Record<string, any>;
}

/**
 * Brand Kit Service
 */
export class BrandKitService {
  private brandKit: BrandKit | null = null;
  private brandKitPath: string;

  constructor(brandKitPath?: string) {
    this.brandKitPath = brandKitPath || path.join(process.cwd(), 'brand-kit.json');
  }

  /**
   * Load brand kit from JSON file
   */
  async loadBrandKit(customPath?: string): Promise<BrandKit> {
    const filePath = customPath || this.brandKitPath;

    try {
      logger.info('Loading brand kit', { filePath });

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const brandKit = JSON.parse(fileContent) as BrandKit;

      // Validate brand kit structure
      this.validateBrandKit(brandKit);

      this.brandKit = brandKit;

      logger.info('Brand kit loaded successfully', {
        name: brandKit.name,
        version: brandKit.version,
        styleFamily: brandKit.animationPreferences.styleFamily,
      });

      return brandKit;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn('Brand kit file not found, using default', { filePath });
        this.brandKit = this.getDefaultBrandKit();
        return this.brandKit;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to load brand kit', {
        filePath,
        error: errorMessage,
      });

      throw new ProcessingError(`Failed to load brand kit: ${errorMessage}`);
    }
  }

  /**
   * Get default brand kit (professional style)
   */
  private getDefaultBrandKit(): BrandKit {
    return {
      name: 'Default Professional',
      version: '1.0.0',
      colors: {
        primary: '#2563eb', // Blue
        secondary: '#7c3aed', // Purple
        accent: '#f59e0b', // Amber
        textColor: '#ffffff',
        backgroundColor: '#1f2937', // Dark gray
      },
      typography: {
        fontFamily: 'Inter, sans-serif',
        fontSize: {
          small: 24,
          medium: 48,
          large: 72,
        },
        fontWeight: 700,
        lineHeight: 1.2,
      },
      animationPreferences: {
        styleFamily: 'professional',
        preferredTemplates: [
          'animated-text',
          'slide-text',
          'pulsing-text',
        ],
        timing: {
          textAppearDuration: 300,
          textDisappearDuration: 200,
          transitionDuration: 400,
          zoomDuration: 400,
        },
      },
      transitionPreferences: {
        type: 'fade',
        duration: 400,
        easing: 'ease-in-out',
      },
      effectPreferences: {
        intensity: {
          colorGrading: 0.3,
          contrast: 1.1,
          saturation: 1.1,
          sharpness: 0.2,
          vignette: 0.12,
        },
      },
    };
  }

  /**
   * Validate brand kit structure
   */
  private validateBrandKit(brandKit: BrandKit): void {
    // Check required fields
    if (!brandKit.name || !brandKit.version) {
      throw new Error('Brand kit must have name and version');
    }

    // Validate colors
    if (!brandKit.colors || !this.isValidHexColor(brandKit.colors.primary)) {
      throw new Error('Brand kit must have valid color scheme');
    }

    // Validate typography
    if (!brandKit.typography || !brandKit.typography.fontFamily) {
      throw new Error('Brand kit must have typography configuration');
    }

    // Validate animation preferences
    if (!brandKit.animationPreferences || !brandKit.animationPreferences.styleFamily) {
      throw new Error('Brand kit must have animation preferences');
    }

    const validStyleFamilies = ['modern', 'minimal', 'dynamic', 'playful', 'professional'];
    if (!validStyleFamilies.includes(brandKit.animationPreferences.styleFamily)) {
      throw new Error(
        `Invalid style family: ${brandKit.animationPreferences.styleFamily}. Must be one of: ${validStyleFamilies.join(', ')}`
      );
    }

    // Validate transition preferences
    if (!brandKit.transitionPreferences) {
      throw new Error('Brand kit must have transition preferences');
    }

    const validTransitionTypes = ['fade', 'slide', 'wipe'];
    if (!validTransitionTypes.includes(brandKit.transitionPreferences.type)) {
      throw new Error(
        `Invalid transition type: ${brandKit.transitionPreferences.type}. Must be one of: ${validTransitionTypes.join(', ')}`
      );
    }

    // Validate transition duration (300-500ms)
    const duration = brandKit.transitionPreferences.duration;
    if (duration < 300 || duration > 500) {
      throw new Error(
        `Transition duration must be between 300-500ms, got ${duration}ms`
      );
    }

    // Validate effect intensity ranges
    const intensity = brandKit.effectPreferences.intensity;
    if (intensity.saturation < 0.5 || intensity.saturation > 1.5) {
      throw new Error(
        `Saturation must be between 0.5 and 1.5, got ${intensity.saturation}`
      );
    }
    if (intensity.contrast < 0.8 || intensity.contrast > 1.3) {
      throw new Error(
        `Contrast must be between 0.8 and 1.3, got ${intensity.contrast}`
      );
    }
    if (intensity.vignette < 0.1 || intensity.vignette > 0.15) {
      throw new Error(
        `Vignette must be between 0.1 and 0.15, got ${intensity.vignette}`
      );
    }

    logger.debug('Brand kit validation passed');
  }

  /**
   * Validate hex color format
   */
  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  /**
   * Generate style guide from brand kit and video metadata
   */
  async generateStyleGuide(videoMetadata: VideoMetadata): Promise<StyleGuide> {
    // Ensure brand kit is loaded
    if (!this.brandKit) {
      await this.loadBrandKit();
    }

    if (!this.brandKit) {
      throw new Error('Brand kit not loaded');
    }

    logger.info('Generating style guide', {
      brandKit: this.brandKit.name,
      videoDuration: videoMetadata.duration,
      resolution: `${videoMetadata.resolution.width}x${videoMetadata.resolution.height}`,
    });

    // Select specific templates based on style family
    const selectedTemplates = this.selectTemplatesForStyleFamily(
      this.brandKit.animationPreferences.styleFamily,
      this.brandKit.animationPreferences.preferredTemplates
    );

    const styleGuide: StyleGuide = {
      brandKit: this.brandKit,
      videoMetadata,
      colorScheme: this.brandKit.colors,
      typography: this.brandKit.typography,
      animationTiming: {
        textAppearDuration: this.brandKit.animationPreferences.timing.textAppearDuration,
        textDisappearDuration: this.brandKit.animationPreferences.timing.textDisappearDuration,
        transitionDuration: this.brandKit.animationPreferences.timing.transitionDuration,
        zoomDuration: this.brandKit.animationPreferences.timing.zoomDuration,
      },
      transitionStyle: {
        type: this.brandKit.transitionPreferences.type,
        duration: this.brandKit.transitionPreferences.duration,
        easing: this.brandKit.transitionPreferences.easing,
      },
      effectIntensity: {
        colorGrading: this.brandKit.effectPreferences.intensity.colorGrading,
        contrast: this.brandKit.effectPreferences.intensity.contrast,
        saturation: this.brandKit.effectPreferences.intensity.saturation,
        sharpness: this.brandKit.effectPreferences.intensity.sharpness,
        vignette: this.brandKit.effectPreferences.intensity.vignette,
      },
      selectedTemplates,
    };

    logger.info('Style guide generated', {
      selectedTemplates: selectedTemplates.length,
      transitionType: styleGuide.transitionStyle.type,
      styleFamily: this.brandKit.animationPreferences.styleFamily,
    });

    return styleGuide;
  }

  /**
   * Select templates based on style family
   */
  private selectTemplatesForStyleFamily(
    styleFamily: string,
    preferredTemplates: string[]
  ): string[] {
    // If preferred templates are specified, use those
    if (preferredTemplates && preferredTemplates.length > 0) {
      return preferredTemplates;
    }

    // Otherwise, select based on style family
    const templatesByFamily: Record<string, string[]> = {
      modern: ['animated-text', 'slide-text', 'geometric-patterns', 'liquid-wave'],
      minimal: ['animated-text', 'slide-text', 'pulsing-text'],
      dynamic: ['bounce-text', 'particle-explosion', 'sound-wave', 'glitch-text'],
      playful: ['bubble-pop-text', 'floating-bubble-text', 'bounce-text', 'card-flip'],
      professional: ['animated-text', 'slide-text', 'pulsing-text', 'typewriter-subtitle'],
    };

    return templatesByFamily[styleFamily] || templatesByFamily.professional;
  }

  /**
   * Validate editing plan against style guide
   */
  validateStyleConsistency(
    editingPlan: any,
    styleGuide: StyleGuide
  ): StyleValidation {
    const violations: StyleViolation[] = [];

    // Validate animation templates are from selected set
    if (editingPlan.animations) {
      const usedTemplates = new Set<string>();
      
      for (const animation of editingPlan.animations) {
        usedTemplates.add(animation.template);
        
        if (!styleGuide.selectedTemplates.includes(animation.template)) {
          violations.push({
            element: `animation-${animation.template}`,
            property: 'template',
            expected: `One of: ${styleGuide.selectedTemplates.join(', ')}`,
            actual: animation.template,
            severity: 'error',
          });
        }
      }

      // Check if multiple template families are used (should be consistent)
      if (usedTemplates.size > styleGuide.selectedTemplates.length) {
        violations.push({
          element: 'animations',
          property: 'template-consistency',
          expected: `Templates from style family: ${styleGuide.brandKit.animationPreferences.styleFamily}`,
          actual: `Using ${usedTemplates.size} different templates`,
          severity: 'warning',
        });
      }
    }

    // Validate transitions use consistent type
    if (editingPlan.transitions) {
      const transitionTypes = new Set<string>();
      
      for (const transition of editingPlan.transitions) {
        transitionTypes.add(transition.type);
        
        if (transition.type !== styleGuide.transitionStyle.type) {
          violations.push({
            element: `transition-${transition.time}`,
            property: 'type',
            expected: styleGuide.transitionStyle.type,
            actual: transition.type,
            severity: 'error',
          });
        }

        // Validate duration is within bounds (300-500ms)
        if (transition.duration < 300 || transition.duration > 500) {
          violations.push({
            element: `transition-${transition.time}`,
            property: 'duration',
            expected: '300-500ms',
            actual: `${transition.duration}ms`,
            severity: 'error',
          });
        }
      }

      // Check for consistent transition type
      if (transitionTypes.size > 1) {
        violations.push({
          element: 'transitions',
          property: 'type-consistency',
          expected: 'Single transition type throughout video',
          actual: `Using ${transitionTypes.size} different types: ${Array.from(transitionTypes).join(', ')}`,
          severity: 'error',
        });
      }
    }

    // Validate text highlights have consistent styling
    if (editingPlan.textHighlights) {
      const fontFamilies = new Set<string>();
      const colors = new Set<string>();
      
      for (const textHighlight of editingPlan.textHighlights) {
        if (textHighlight.style) {
          if (textHighlight.style.fontFamily) {
            fontFamilies.add(textHighlight.style.fontFamily);
          }
          if (textHighlight.style.color) {
            colors.add(textHighlight.style.color);
          }

          // Validate against style guide
          if (
            textHighlight.style.fontFamily &&
            textHighlight.style.fontFamily !== styleGuide.typography.fontFamily
          ) {
            violations.push({
              element: `text-${textHighlight.text}`,
              property: 'fontFamily',
              expected: styleGuide.typography.fontFamily,
              actual: textHighlight.style.fontFamily,
              severity: 'warning',
            });
          }
        }
      }

      // Check for consistency
      if (fontFamilies.size > 1) {
        violations.push({
          element: 'textHighlights',
          property: 'fontFamily-consistency',
          expected: 'Single font family throughout video',
          actual: `Using ${fontFamilies.size} different fonts`,
          severity: 'warning',
        });
      }
    }

    const isConsistent = violations.filter((v) => v.severity === 'error').length === 0;

    logger.info('Style consistency validation complete', {
      isConsistent,
      violations: violations.length,
      errors: violations.filter((v) => v.severity === 'error').length,
      warnings: violations.filter((v) => v.severity === 'warning').length,
    });

    return {
      isConsistent,
      violations,
    };
  }

  /**
   * Apply style guide to visual element
   */
  applyStyleGuide(element: VisualElement, styleGuide: StyleGuide): VisualElement {
    const styledElement = { ...element };

    switch (element.type) {
      case 'text':
        styledElement.properties = {
          ...element.properties,
          fontFamily: styleGuide.typography.fontFamily,
          fontSize: element.properties.fontSize || styleGuide.typography.fontSize.medium,
          fontWeight: styleGuide.typography.fontWeight,
          color: element.properties.color || styleGuide.colorScheme.textColor,
        };
        break;

      case 'animation':
        // Ensure animation uses selected templates
        if (element.properties.template) {
          if (!styleGuide.selectedTemplates.includes(element.properties.template)) {
            // Replace with first selected template
            styledElement.properties.template = styleGuide.selectedTemplates[0];
            logger.warn('Replaced non-conforming animation template', {
              original: element.properties.template,
              replacement: styleGuide.selectedTemplates[0],
            });
          }
        }
        break;

      case 'transition':
        styledElement.properties = {
          ...element.properties,
          type: styleGuide.transitionStyle.type,
          duration: styleGuide.transitionStyle.duration,
          easing: styleGuide.transitionStyle.easing,
        };
        break;

      case 'effect':
        // Apply effect intensity from style guide
        styledElement.properties = {
          ...element.properties,
          intensity: styleGuide.effectIntensity,
        };
        break;
    }

    return styledElement;
  }

  /**
   * Save brand kit to file
   */
  async saveBrandKit(brandKit: BrandKit, outputPath?: string): Promise<void> {
    const filePath = outputPath || this.brandKitPath;

    try {
      // Validate before saving
      this.validateBrandKit(brandKit);

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, JSON.stringify(brandKit, null, 2), 'utf-8');

      logger.info('Brand kit saved', {
        filePath,
        name: brandKit.name,
        version: brandKit.version,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to save brand kit', {
        filePath,
        error: errorMessage,
      });

      throw new ProcessingError(`Failed to save brand kit: ${errorMessage}`);
    }
  }

  /**
   * Get current brand kit
   */
  getBrandKit(): BrandKit | null {
    return this.brandKit;
  }
}
