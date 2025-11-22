/**
 * Brand Constants Adapter
 * 
 * Converts existing brand constants (like Crown Mercado's brandConstants.ts)
 * to the BrandKit format used by the style guide system
 */

import { BrandKit } from './brandKitService';
import { CROWN_MERCADO_BRAND } from '../../remotion/brandConstants';

/**
 * Convert Crown Mercado brand constants to BrandKit format
 */
export function crownMercadoBrandKit(): BrandKit {
  return {
    name: 'Crown Mercado',
    version: '1.0.0',
    colors: {
      primary: CROWN_MERCADO_BRAND.colors.primaryRed,
      secondary: CROWN_MERCADO_BRAND.colors.charcoal,
      accent: CROWN_MERCADO_BRAND.colors.accentRed,
      textColor: CROWN_MERCADO_BRAND.colors.textPrimary,
      backgroundColor: CROWN_MERCADO_BRAND.colors.charcoal,
    },
    typography: {
      fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
      fontSize: {
        small: 28, // Converted from rem to pixels (assuming 16px base)
        medium: 56,
        large: 84,
      },
      fontWeight: 700, // Bold
      lineHeight: 1.2,
    },
    animationPreferences: {
      styleFamily: 'professional',
      preferredTemplates: [
        'animated-text',
        'slide-text',
        'geometric-patterns', // Uses Crown Mercado's triangle motif
      ],
      timing: {
        textAppearDuration: CROWN_MERCADO_BRAND.timing.fadeIn * (1000 / 30), // Convert frames to ms
        textDisappearDuration: CROWN_MERCADO_BRAND.timing.fadeOut * (1000 / 30),
        transitionDuration: CROWN_MERCADO_BRAND.timing.transition * (1000 / 30),
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
        colorGrading: 0.35, // Slightly higher for bold brand
        contrast: 1.15, // Higher contrast for professional look
        saturation: 1.1,
        sharpness: 0.25,
        vignette: 0.12,
      },
    },
  };
}

/**
 * Get brand colors for use in templates
 */
export function getBrandColors() {
  return CROWN_MERCADO_BRAND.colors;
}

/**
 * Get brand typography for use in templates
 */
export function getBrandTypography() {
  return CROWN_MERCADO_BRAND.typography;
}

/**
 * Get brand patterns (geometric triangles)
 */
export function getBrandPatterns() {
  return CROWN_MERCADO_BRAND.patterns;
}

/**
 * Get brand timing for animations
 */
export function getBrandTiming() {
  return CROWN_MERCADO_BRAND.timing;
}

/**
 * Get complete brand theme
 */
export function getCrownMercadoBrand() {
  return CROWN_MERCADO_BRAND;
}
