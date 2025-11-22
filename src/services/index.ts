// Video Processing
export * from './video-processing';

// Transcription & Storage  
export * from './transcription';

// Content Analysis (explicit exports to avoid conflicts)
export { HighlightDetectionService, EditingPlanService } from './content-analysis';
export type {
  Highlight,
  EditingPlanInput,
  EditingPlan,
  HighlightEffect,
  AnimationEffect,
  TransitionEffect,
  BrollPlacement,
} from './content-analysis';

// Media
export * from './media';

// Upload
export * from './upload';

// Pipeline
export * from './pipeline';

// Preview
export * from './preview';

// Rendering
export * from './rendering';

// Storage
export * from './storage/wasabiStorageService';

// Notification
export * from './notification';

// Style (Brand Kit & Style Guide) - explicit exports to avoid conflicts
export { BrandKitService } from './style';
export type {
  BrandKit,
  ColorScheme,
  Typography as BrandTypography,
  AnimationPreferences,
  TransitionPreferences,
  EffectPreferences,
  StyleGuide,
  VideoMetadata as BrandVideoMetadata,
  AnimationTiming,
  TransitionStyle,
  EffectIntensity,
  StyleValidation,
  StyleViolation,
  VisualElement,
} from './style';
export {
  crownMercadoBrandKit,
  getBrandColors,
  getBrandTypography,
  getBrandPatterns,
  getBrandTiming,
  getCrownMercadoBrand,
} from './style';
