/**
 * Brand Kit Helper for Remotion Templates
 * 
 * Utilities to apply brand kit styling to Remotion templates
 */

import { CROWN_MERCADO_BRAND } from './brandConstants';

export interface BrandKitColors {
  primary: string;
  secondary: string;
  accent: string;
  textColor: string;
  backgroundColor: string;
}

export interface BrandKitTypography {
  fontFamily: string;
  fontSize: {
    small: number;
    medium: number;
    large: number;
  };
  fontWeight: number;
}

/**
 * Convert brand kit colors to template props
 */
export function getBrandColors(brandKit?: BrandKitColors): BrandKitColors {
  if (brandKit) {
    return brandKit;
  }

  // Default to Crown Mercado brand
  return {
    primary: CROWN_MERCADO_BRAND.colors.primaryRed,
    secondary: CROWN_MERCADO_BRAND.colors.charcoal,
    accent: CROWN_MERCADO_BRAND.colors.accentRed,
    textColor: CROWN_MERCADO_BRAND.colors.textPrimary,
    backgroundColor: CROWN_MERCADO_BRAND.colors.charcoal,
  };
}

/**
 * Convert brand kit typography to template props
 */
export function getBrandTypography(brandKit?: BrandKitTypography): BrandKitTypography {
  if (brandKit) {
    return brandKit;
  }

  // Default to Crown Mercado brand
  return {
    fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
    fontSize: {
      small: 28,
      medium: 56,
      large: 84,
    },
    fontWeight: 700,
  };
}

/**
 * Apply brand kit to text template props
 */
export function applyBrandKitToTextProps(
  props: any,
  brandKit?: { colors?: BrandKitColors; typography?: BrandKitTypography }
): any {
  const colors = getBrandColors(brandKit?.colors);
  const typography = getBrandTypography(brandKit?.typography);

  return {
    ...props,
    color: props.color || colors.textColor,
    fontFamily: props.fontFamily || typography.fontFamily,
    fontWeight: props.fontWeight || typography.fontWeight,
    fontSize: props.fontSize || `${typography.fontSize.medium}px`,
  };
}

/**
 * Apply brand kit to geometric patterns props
 */
export function applyBrandKitToGeometricProps(
  props: any,
  brandKit?: { colors?: BrandKitColors }
): any {
  const colors = getBrandColors(brandKit?.colors);

  return {
    ...props,
    primaryColor: props.primaryColor || colors.primary,
    secondaryColor: props.secondaryColor || colors.secondary,
    accentColor: props.accentColor || colors.accent,
    backgroundColor: props.backgroundColor || colors.backgroundColor,
  };
}

/**
 * Get Crown Mercado triangle colors for geometric patterns
 */
export function getCrownMercadoTriangleColors() {
  return {
    primaryColor: CROWN_MERCADO_BRAND.patterns.triangles.primary.color1,
    secondaryColor: CROWN_MERCADO_BRAND.patterns.triangles.primary.color2,
    tertiaryColor: CROWN_MERCADO_BRAND.patterns.triangles.primary.color3,
    backgroundColor: CROWN_MERCADO_BRAND.colors.charcoal,
    accentColor: CROWN_MERCADO_BRAND.colors.accentRed,
  };
}

/**
 * Apply brand kit styling to text highlights
 * Requirements 16.5: Apply brand kit styling to all text elements
 */
export function applyBrandKitToTextStyle(
  textHighlight: any,
  brandKit?: { colors?: BrandKitColors; typography?: BrandKitTypography }
): any {
  const colors = getBrandColors(brandKit?.colors);
  const typography = getBrandTypography(brandKit?.typography);

  // Apply brand kit defaults if not specified
  const style = {
    ...textHighlight.style,
    fontFamily: textHighlight.style?.fontFamily || typography.fontFamily,
    fontSize: textHighlight.style?.fontSize || typography.fontSize.medium,
    fontWeight: textHighlight.style?.fontWeight || typography.fontWeight,
    color: textHighlight.style?.color || colors.textColor,
    backgroundColor: textHighlight.style?.backgroundColor || `${colors.backgroundColor}E6`, // 90% opacity
  };

  return {
    ...textHighlight,
    style,
  };
}
