/**
 * Defines the allowed types of transitions between video segments.
 * - 'cut': An instant cut with no visual effect.
 * - 'fadeCamera': A simple fade transition, often accompanied by a camera-like SFX.
 * - 'slideWhoosh': A sliding transition, often accompanied by a whoosh SFX.
 */
export type TransitionType = 'cut' | 'fadeCamera' | 'slideWhoosh';

/**
 * Defines the allowed directions for slide transitions.
 */
export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Represents a plan for a video transition.
 */
export interface TransitionPlan {
  /** The type of transition to apply. */
  type: TransitionType;
  /** Optional duration of the transition in seconds. */
  duration?: number;
  /** Optional direction for slide transitions. */
  direction?: TransitionDirection;
  /** Optional path to a sound effect to play during the transition. */
  sfx?: string;
}

/**
 * Defines the kind of a video segment.
 * - 'normal': A regular video segment from the source footage.
 * - 'broll': A placeholder segment for B-roll footage.
 */
export type SegmentKind = 'normal' | 'broll';

/**
 * Defines the camera movement to apply to a segment.
 * - 'static': No camera movement.
 * - 'zoomIn': A subtle zoom-in effect.
 * - 'zoomOut': A subtle zoom-out effect.
 */
export type CameraMovement = 'static' | 'zoomIn' | 'zoomOut';

/**
 * Represents a plan for a single video segment.
 */
export type MotionCue =
  | 'pan'
  | 'zoomIn'
  | 'zoomOut'
  | 'shake'
  | 'tiltUp'
  | 'tiltDown';

export type BrollMode = 'overlay' | 'full' | 'pictureInPicture';

export interface SegmentBrollPlan {
  id?: string;
  file?: string;
  mode?: BrollMode;
  confidence?: number;
  reasons?: string[];
  startAt?: number;
  playbackRate?: number;
  duration?: number;
}

export interface SegmentPlan {
  /** A unique identifier for the segment. */
  id: string;
  /** The kind of segment (normal or broll). */
  kind?: SegmentKind;
  /** Optional start time of this segment in the source video (in seconds). */
  sourceStart?: number;
  /** The duration of the segment in seconds. */
  duration: number;
  /** Optional transition to apply when entering this segment. */
  transitionIn?: TransitionPlan;
  /** Optional transition to apply when exiting this segment. */
  transitionOut?: TransitionPlan;
  /** Optional short label for the segment, useful for display or debugging. */
  label?: string;
  /** Optional title for the segment. */
  title?: string;
  /** Optional playback rate for the segment (e.g., 1.0 for normal speed). */
  playbackRate?: number;
  /** Optional camera movement to apply to the segment. */
  cameraMovement?: CameraMovement;
  /** Optional flag indicating if there should be silence after this segment. */
  motionCue?: MotionCue;
  silenceAfter?: boolean;
  /** Optional arbitrary metadata associated with the segment. */
  metadata?: Record<string, unknown>;
  broll?: SegmentBrollPlan | null;
  /** Optional array of suggested sound effect categories. */
  sfxHints?: string[];
  /** Optional explanatory notes about automatic decisions. */
  notes?: string[];
}

/**
 * Defines the allowed types of highlights.
 * - 'typewriter': Text appears with a typewriter effect.
 * - 'noteBox': A box containing text, often used for callouts.
 * - 'sectionTitle': A full-screen title card for sections.
 * - 'icon': Displays an icon with optional text.
 */
export type HighlightType = 'typewriter' | 'noteBox' | 'sectionTitle' | 'icon';

/**
 * Defines the allowed animation types for icons.
 */
export type IconAnimation = 'float' | 'pulse' | 'spin' | 'pop';

/**
 * Defines the allowed positions for highlights on the screen.
 */
export type HighlightPosition = 'top' | 'center' | 'bottom';

/**
 * Represents a plan for a single highlight element in the video.
 */
export interface HighlightSupportingTexts {
  topLeft?: string;
  topRight?: string;
  topCenter?: string;
  bottomLeft?: string;
}

export interface HighlightOverlay {
  image?: string;
  tint?: string;
  opacity?: number;
  blendMode?: string;
  blur?: number;
}

export type HighlightLayout = 'auto' | 'left' | 'right' | 'dual' | 'bottom';
export type HighlightImportance = 'primary' | 'supporting';

export interface HighlightPlan {
  /** A unique identifier for the highlight. */
  id: string;
  /** Optional type of highlight. Defaults to 'noteBox'. */
  type?: HighlightType;
  /** Optional main text content for the highlight. */
  text?: string;
  /** Optional canonical keyword text (maps to bottom callout). */
  keyword?: string;
  /** Optional title for 'sectionTitle' or other types. */
  title?: string;
  /** Optional subtitle for 'sectionTitle'. */
  subtitle?: string;
  /** Optional badge text. */
  badge?: string;
  /** Optional name for 'icon' type, e.g., "Rocket". */
  name?: string;
  /** Optional icon identifier for 'icon' type (e.g., 'launch', 'fa:robot'). */
  icon?: string;
  /** Optional asset path for custom media in the highlight. */
  asset?: string;
  /** The start time of the highlight in seconds. */
  start: number;
  /** The duration of the highlight in seconds. */
  duration: number;
  /** Optional position of the highlight on the screen. Defaults to 'center'. */
  position?: HighlightPosition;
  /** Optional side alignment for certain highlight variants. */
  side?: 'bottom' | 'left' | 'right' | 'top';
  /** Optional background color or gradient for the highlight. */
  bg?: string;
  /** Optional border radius for the highlight container. */
  radius?: number;
  /** Optional path to a sound effect to play with the highlight. */
  sfx?: string;
  /** Optional gain adjustment for the highlight's SFX. */
  gain?: number;
  /** Optional flag to duck (lower) background audio when this highlight's SFX plays. */
  ducking?: boolean;
  /** Optional accent color for the highlight. */
  accentColor?: string;
  /** Optional background color for the highlight. */
  backgroundColor?: string;
  /** Optional color for the icon in an 'icon' highlight. */
  iconColor?: string;
  /** Optional animation type for the highlight. */
  animation?: IconAnimation;
  /** Optional variant string for custom styling. */
  variant?: string;
  /** Optional supporting texts mapped to screen positions. */
  supportingTexts?: HighlightSupportingTexts;
  /** Optional overlay configuration for section cards or advanced layouts. */
  overlay?: HighlightOverlay;
  /** Optional explicit layout for text rendering. */
  layout?: HighlightLayout;
  /** Optional semantic importance flag (primary -> bottom banner). */
  importance?: HighlightImportance;
  /** Optional hint to repeat this highlight every N seconds. */
  repeatEvery?: number;
  /** Optional density multiplier for adaptive scheduling. */
  frequencyMultiplier?: number;
  /** Allows for additional arbitrary properties. */
  [key: string]: unknown;
}

/**
 * The main interface for the entire video editing plan.
 * It contains a sequence of segments and a list of highlights.
 */
export interface Plan {
  /** An array of video segments. */
  segments: SegmentPlan[];
  /** An array of highlight elements. */
  highlights: HighlightPlan[];
  /** Optional arbitrary metadata for the entire plan. */
  meta?: Record<string, unknown>;
}

/**
 * Defines the theme properties for highlights.
 */
export interface HighlightTheme {
  /** Optional background color for highlights. */
  backgroundColor?: string;
  /** Optional text color for highlights. */
  textColor?: string;
  /** Optional accent color for highlights. */
  accentColor?: string;
  /** Optional font family for highlights. */
  fontFamily?: string;
}

/**
 * Defines overrides for the composition's runtime configuration.
 */
export interface CompositionConfigOverrides {
  /** Optional override for minimum pause duration in milliseconds. */
  minPauseMs?: number;
  /** Partial overrides for audio settings. */
  audio?: Partial<{voiceDuckDb: number; sfxBaseGainDb: number}>;
  /** Partial overrides for transition settings. */
  transitions?: Partial<{defaultFade: number}>;
  /** Partial overrides for brand-related settings. */
  brand?: Partial<Record<string, string>>;
}

/**
 * Defines the properties passed to the FinalComposition component.
 */
export interface FinalCompositionProps {
  /** Optional direct plan object. If provided, `planPath` is ignored. */
  plan?: Plan | null;
  /** Optional path to a JSON plan file. */
  planPath?: string;
  /** Optional path to the input video file. */
  inputVideo?: string;
  /** Optional fallback duration for transitions in seconds. */
  fallbackTransitionDuration?: number;
  /** Optional theme overrides for highlights. */
  highlightTheme?: HighlightTheme;
  /** Optional configuration overrides for the composition. */
  config?: CompositionConfigOverrides;
}
