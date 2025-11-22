/**
 * Crown Mercado Brand Constants
 * 
 * Brand identity guidelines and visual constants for Crown Mercado
 */

// Color Palette
export const BRAND_COLORS = {
  // Primary Colors
  primaryRed: '#C8102E',
  charcoal: '#1C1C1C',
  white: '#FFFFFF',
  
  // Supporting Colors
  lightGray: '#F2F2F2',
  
  // Text Colors
  textPrimary: '#FFFFFF',
  textSecondary: '#F2F2F2',
  accentRed: '#C8102E',
} as const;

// Typography
export const BRAND_TYPOGRAPHY = {
  // Font Families
  headlineFont: 'Montserrat, sans-serif',
  bodyFont: 'Open Sans, sans-serif',
  
  // Font Weights
  fontWeightBold: 'bold',
  fontWeightNormal: 'normal',
  fontWeightSemiBold: '600',
  
  // Font Sizes (in rem for responsive design)
  fontSize: {
    headline: '3.5rem',
    subtitle: '2rem',
    body: '1.2rem',
    small: '0.9rem',
  }
} as const;

// Animation Timing
export const BRAND_TIMING = {
  // Duration in frames (assuming 30fps)
  fadeIn: 15,      // 0.5 seconds
  fadeOut: 15,     // 0.5 seconds
  transition: 30,   // 1 second
  highlight: 45,     // 1.5 seconds
  
  // Spring physics for animations
  spring: {
    mass: 0.8,
    damping: 12,
    stiffness: 100,
  }
} as const;

// Geometric Patterns (triangles as specified in brand kit)
export const BRAND_PATTERNS = {
  triangles: {
    // Layered triangles in red gradients (futuristic + dynamic)
    primary: {
      color1: '#C8102E',
      color2: '#A0081E',
      color3: '#8B0000',
    },
    secondary: {
      color1: '#1C1C1C',
      color2: '#3A3A3A',
      color3: '#585858',
    }
  }
} as const;

// Layout Constants
export const BRAND_LAYOUT = {
  // Spacing and positioning
  padding: {
    xl: '40px',
    large: '32px',
    medium: '24px',
    small: '12px',
    xs: '8px',
  },
  margin: {
    large: '32px',
    medium: '16px',
    small: '8px',
  },
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '16px',
  }
} as const;

// Export combined brand theme
export const CROWN_MERCADO_BRAND = {
  colors: BRAND_COLORS,
  typography: BRAND_TYPOGRAPHY,
  timing: BRAND_TIMING,
  patterns: BRAND_PATTERNS,
  layout: BRAND_LAYOUT,
} as const;