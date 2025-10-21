import {z} from 'zod';
import type {
  BrollMode,
  CameraMovement,
  HighlightPlan,
  HighlightPosition,
  HighlightType,
  IconAnimation,
  MotionCue,
  Plan,
  SegmentBrollPlan,
  SegmentPlan,
  TransitionDirection,
  TransitionPlan,
  TransitionType,
} from '../types';

/**
 * Normalizes a transition type token by trimming, removing spaces/underscores/hyphens, and converting to lowercase.
 * @param value The raw transition type token.
 * @returns The normalized token or the original value if not a string.
 */
const normalizeTransitionToken = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/[\s_-]+/g, '').toLowerCase();
};

/**
 * Zod schema for `TransitionType`.
 * It preprocesses the input token and transforms common aliases to canonical types.
 */
const transitionTypeSchema: z.ZodType<TransitionType, z.ZodTypeDef, unknown> = z
  .preprocess(normalizeTransitionToken, z.enum([
    'cut',
    'fadecamera',
    'slidewhoosh',
    'crossfade',
    'slide',
    'zoom',
    'scale',
    'rotate',
    'blur',
  ]))
  .transform((value): TransitionType => {
    switch (value) {
      case 'cut':
        return 'cut';
      case 'slidewhoosh':
      case 'slide': // Map 'slide' to 'slideWhoosh'
        return 'slideWhoosh';
      default: // Default to 'fadeCamera' for unrecognized types
        return 'fadeCamera';
    }
  });

/**
 * Zod schema for `TransitionDirection`.
 */
const transitionDirectionSchema: z.ZodType<TransitionDirection> = z.enum([
  'left',
  'right',
  'up',
  'down',
]);

/**
 * Zod schema for `TransitionPlan`.
 * It ensures that `direction` is only present for 'slideWhoosh' transitions.
 */
const transitionPlanSchema: z.ZodType<TransitionPlan, z.ZodTypeDef, unknown> = z
  .object({
    type: transitionTypeSchema,
    duration: z.number().positive().optional(),
    direction: transitionDirectionSchema.optional(),
    sfx: z.string().optional(),
  })
  .transform((transition) => {
    // Remove 'direction' if the transition type is not 'slideWhoosh'
    if (transition.type !== 'slideWhoosh') {
      const {direction, ...rest} = transition;
      return rest;
    }
    return transition;
  });

/**
 * Zod schema for `CameraMovement`.
 */
const cameraMovementSchema: z.ZodType<CameraMovement> = z.enum(['static', 'zoomIn', 'zoomOut']);

/**
 * Zod schema for `SegmentKind`, defaulting to 'normal'.
 */
const segmentKindSchema: z.ZodType<SegmentPlan['kind'], z.ZodTypeDef, unknown> = z.enum(['normal', 'broll']).catch('normal');

const normalizeBrollModeToken = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed.length) {
    return value;
  }

  if (['full', 'fullscreen', 'replace', 'cover', 'wide'].includes(trimmed)) {
    return 'full';
  }

  if (['pip', 'pictureinpicture', 'picture-in-picture', 'picture'].includes(trimmed)) {
    return 'pictureInPicture';
  }

  return 'overlay';
};

const brollModeSchema: z.ZodType<BrollMode> = z
  .preprocess(normalizeBrollModeToken, z.enum(['overlay', 'full', 'pictureInPicture']))
  .transform((value) => {
    switch (value) {
      case 'overlay':
        return 'overlay';
      case 'pictureInPicture':
        return 'pictureInPicture';
      default:
        return 'full';
    }
  });

const brollPlanSchema: z.ZodType<SegmentBrollPlan> = z
  .object({
    id: z.string().optional(),
    file: z.string().optional(),
    mode: brollModeSchema.optional(),
    confidence: z.number().optional(),
    reasons: z.array(z.string()).optional(),
    startAt: z.number().min(0).optional(),
    playbackRate: z.number().positive().optional(),
  })
  .passthrough()
  .transform((broll) => ({
    ...broll,
    mode: broll.mode ?? 'overlay',
  }));

const motionCueSchema: z.ZodType<MotionCue | undefined> = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    switch (normalized) {
      case 'pan':
      case 'slide':
      case 'push':
        return 'pan';
      case 'zoomin':
      case 'zoom-in':
      case 'pushin':
      case 'zoom':
        return 'zoomIn';
      case 'zoomout':
      case 'zoom-out':
      case 'pullback':
      case 'pull':
        return 'zoomOut';
      case 'shake':
      case 'rumble':
      case 'impact':
        return 'shake';
      case 'tiltup':
      case 'tilt-up':
      case 'panup':
        return 'tiltUp';
      case 'tiltdown':
      case 'tilt-down':
      case 'pandown':
        return 'tiltDown';
      default:
        return undefined;
    }
  });

/**
 * Zod schema for `SegmentPlan`.
 * Handles alias fields and default values.
 */
const segmentPlanSchema: z.ZodType<SegmentPlan> = z
  .object({
    id: z.string(),
    kind: segmentKindSchema.optional(),
    sourceStart: z.number().min(0).optional(),
    duration: z.number().positive(),
    transitionIn: transitionPlanSchema.optional(),
    transitionOut: transitionPlanSchema.optional(),
    transition: transitionPlanSchema.optional(), // Alias for transitionOut
    label: z.string().optional(),
    title: z.string().optional(),
    playbackRate: z.number().positive().optional(),
    cameraMovement: cameraMovementSchema.optional(),
    motionCue: motionCueSchema,
    silenceAfter: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
    sfxHints: z.array(z.string()).optional(),
    notes: z.array(z.string()).optional(),
    broll: brollPlanSchema.optional(),
  })
  .transform((segment) => {
    const {transition, sfxHints, notes, ...rest} = segment;
    // Resolve transitionOut, prioritizing explicit transitionOut, then 'transition' alias
    const resolvedTransitionOut = rest.transitionOut ?? transition;

    return {
      ...rest,
      transitionOut: resolvedTransitionOut ?? undefined,
      kind: rest.kind ?? 'normal', // Ensure kind has a default
      sfxHints: sfxHints ?? [],
      notes: notes ?? [],
    } as SegmentPlan;
  });

/**
 * Normalizes a highlight type token, mapping common aliases to canonical types.
 * @param value The raw highlight type token.
 * @returns The normalized token or the original value if not a string or no mapping found.
 */
const normalizeHighlightTypeToken = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim().toLowerCase();
  const collapsed = trimmed.replace(/[\s_-]+/g, ''); // Remove all spaces, underscores, hyphens

  switch (collapsed) {
    case 'icon':
    case 'iconhighlight':
      return 'icon';
    case 'notebox':
      return 'noteBox';
    case 'sectiontitle':
      return 'sectionTitle';
    case 'typewriter':
      return 'typewriter';
    default:
      return value;
  }
};

/**
 * Zod schema for `HighlightType`, defaulting to 'noteBox'.
 */
const highlightTypeSchema: z.ZodType<HighlightType, z.ZodTypeDef, unknown> = z
  .preprocess(
    normalizeHighlightTypeToken,
    z.enum(['typewriter', 'noteBox', 'sectionTitle', 'icon']),
  )
  .catch('noteBox');

/**
 * Zod schema for `HighlightPosition`, defaulting to 'center'.
 */
const highlightPositionSchema: z.ZodType<HighlightPosition, z.ZodTypeDef, unknown> = z
  .enum(['top', 'center', 'bottom'])
  .catch('center');

/**
 * Zod schema for `IconAnimation`, transforming raw string inputs to canonical animation types or undefined.
 */
const iconAnimationSchema: z.ZodType<IconAnimation | undefined, z.ZodTypeDef, unknown> = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    switch (normalized) {
      case 'float':
      case 'pulse':
      case 'spin':
      case 'pop':
        return normalized as IconAnimation;
      default:
        return undefined; // Return undefined for unrecognized animations
    }
  });

/**
 * Zod schema for `HighlightPlan`.
 * It ensures `type` defaults to 'noteBox' if not explicitly set.
 */
const highlightPlanSchema: z.ZodType<HighlightPlan, z.ZodTypeDef, z.input<typeof highlightTypeSchema> & z.input<typeof highlightPositionSchema> & z.input<typeof iconAnimationSchema> & {
  id: unknown;
  text?: unknown;
  title?: unknown;
  subtitle?: unknown;
  badge?: unknown;
  name?: unknown;
  icon?: unknown;
  asset?: unknown;
  start: unknown;
  duration: unknown;
  side?: unknown;
  bg?: unknown;
  radius?: unknown;
  sfx?: unknown;
  gain?: unknown;
  ducking?: unknown;
  variant?: unknown;
  accentColor?: unknown;
  backgroundColor?: unknown;
  iconColor?: unknown;
  volume?: unknown;
}> = z
  .object({
    id: z.string(),
    type: highlightTypeSchema.optional(),
    text: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    badge: z.string().optional(),
    name: z.string().optional(),
    icon: z.string().optional(),
    asset: z.string().optional(),
    start: z.number().min(0),
    duration: z.number().positive(),
    position: highlightPositionSchema.optional(),
    side: z.enum(['bottom', 'left', 'right', 'top']).optional(),
    bg: z.string().optional(),
    radius: z.number().optional(),
    sfx: z.string().optional(),
    gain: z.number().optional(),
    ducking: z.boolean().optional(),
    animation: iconAnimationSchema,
    variant: z.string().optional(),
    accentColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    iconColor: z.string().optional(),
    volume: z.number().min(0).max(1).optional(),
  })
  .transform((highlight) => ({
    ...highlight,
    type: highlight.type ?? 'noteBox', // Default highlight type
  }));

/**
 * Zod schema for the main `Plan` object.
 * It ensures `highlights` defaults to an empty array if not provided.
 */
const planSchema: z.ZodType<Plan> = z
  .object({
    segments: z.array(segmentPlanSchema),
    highlights: z.array(highlightPlanSchema).default([]),
    meta: z.record(z.unknown()).optional(),
  })
  .transform((plan) => ({
    ...plan,
    highlights: plan.highlights ?? [], // Ensure highlights is always an array
  }));

/**
 * Type definition for the `planSchema` itself.
 */
export type PlanSchema = typeof planSchema;

/**
 * Parses raw data into a `Plan` object using the defined schema.
 * @param data The raw data to parse.
 * @returns The parsed `Plan` object.
 * @throws ZodError if the data does not conform to the schema.
 */
export const parsePlan = (data: unknown): Plan => planSchema.parse(data);

/**
 * An example `Plan` object, useful for testing or as a template.
 */
export const planExample: Plan = {
  segments: [
    {
      id: 'intro',
      kind: 'normal',
      sourceStart: 0,
      duration: 18,
      cameraMovement: 'zoomIn',
      transitionOut: {type: 'fadeCamera', duration: 1, sfx: 'ui/camera.mp3'},
      silenceAfter: true,
    },
    {
      id: 'main-1',
      kind: 'normal',
      sourceStart: 30,
      duration: 32,
      transitionIn: {type: 'fadeCamera', duration: 0.8},
      transitionOut: {type: 'slideWhoosh', duration: 0.75, direction: 'left', sfx: 'ui/whoosh.mp3'},
      cameraMovement: 'zoomOut',
      silenceAfter: true,
    },
    {
      id: 'broll-1',
      kind: 'broll',
      duration: 6,
      title: 'AI Robot (download later)',
      transitionIn: {type: 'fadeCamera', duration: 0.6},
      transitionOut: {type: 'slideWhoosh', duration: 0.7, direction: 'right'},
      silenceAfter: true,
      metadata: {
        style: 'roundedFrame',
        subtitle: 'Placeholder for future footage',
      },
    },
    {
      id: 'main-2',
      kind: 'normal',
      sourceStart: 90,
      duration: 20,
      transitionIn: {type: 'slideWhoosh', duration: 0.7, direction: 'right'},
      cameraMovement: 'zoomIn',
      silenceAfter: false,
    },
  ],
  highlights: [
    {
      id: 'hook',
      type: 'typewriter',
      text: 'Tăng gấp đôi hiệu suất với workflow tự động hoá.',
      start: 4.5,
      duration: 4,
      position: 'center',
      sfx: 'ui/type.mp3',
    },
    {
      id: 'stat',
      type: 'noteBox',
      text: '48 giờ sản xuất video chỉ còn 6 giờ.',
      start: 22,
      duration: 4.5,
      position: 'bottom',
      side: 'bottom',
      sfx: 'ui/click-soft.mp3',
    },
    {
      id: 'section',
      type: 'sectionTitle',
      title: 'Chiến lược #2',
      subtitle: 'Lên lịch nội dung theo đề xuất AI',
      start: 60,
      duration: 3.5,
      badge: 'Chapter',
    },
    {
      id: 'icon-rocket',
      type: 'icon',
      name: 'Chế độ tăng tốc',
      icon: 'launch',
      start: 86.2,
      duration: 1.6,
      animation: 'pop',
      accentColor: '#f97316',
      backgroundColor: 'linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(15,23,42,0.92) 100%)',
    },
    {
      id: 'icon-ai',
      type: 'icon',
      name: 'AI trợ lực',
      icon: 'fa:robot',
      start: 92,
      duration: 1.8,
      animation: 'spin',
      accentColor: '#38bdf8',
      backgroundColor: 'linear-gradient(135deg, rgba(56,189,248,0.16) 0%, rgba(17,24,39,0.94) 100%)',
    },
  ],
  meta: {
    source_srt: 'input/sample.srt',
  },
};

export default planSchema;
