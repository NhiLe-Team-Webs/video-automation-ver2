/**
 * Style Services
 * 
 * Export brand kit and style guide services
 */

export { BrandKitService } from './brandKitService';
export type {
  BrandKit,
  ColorScheme,
  Typography,
  AnimationPreferences,
  TransitionPreferences,
  EffectPreferences,
  StyleGuide,
  VideoMetadata,
  AnimationTiming,
  TransitionStyle,
  EffectIntensity,
  StyleValidation,
  StyleViolation,
  VisualElement,
} from './brandKitService';

// Brand Constants Adapter
export {
  crownMercadoBrandKit,
  getBrandColors,
  getBrandTypography,
  getBrandPatterns,
  getBrandTiming,
  getCrownMercadoBrand,
} from './brandConstantsAdapter';
