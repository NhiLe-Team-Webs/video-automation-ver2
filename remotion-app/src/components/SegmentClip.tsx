import type {CSSProperties, ReactNode} from 'react';
import {
  Easing,
  Img,
  Video,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {BrollPlaceholder} from './BrollPlaceholder';
import {useSegmentTransition} from './Transitions';
import type {TimelineSegment} from './timeline';
import type {BrollMode, CameraMovement, MotionCue} from '../types';

/**
 * Clamps a number between 0 and 1.
 * @param value The number to clamp.
 * @returns The clamped number.
 */
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Normalizes a raw camera movement input to a valid `CameraMovement` type.
 * @param movement The raw movement value.
 * @returns A normalized `CameraMovement` ('zoomIn', 'zoomOut', or 'static').
 */
const normalizeCameraMovement = (movement: unknown): CameraMovement => {
  if (movement === 'zoomIn' || movement === 'zoomOut') {
    return movement;
  }

  if (typeof movement === 'string') {
    const lower = movement.toLowerCase();
    if (['zoomin', 'zoom-in', 'pushin', 'push'].includes(lower)) {
      return 'zoomIn';
    }
    if (['zoomout', 'zoom-out', 'pullback', 'pull'].includes(lower)) {
      return 'zoomOut';
    }
  }

  return 'static';
};

/**
 * Resolves the camera movement for a given segment, prioritizing explicit `cameraMovement`
 * in the segment plan, then checking metadata.
 * @param segment The segment plan object.
 * @returns The resolved `CameraMovement`.
 */
const resolveCameraMovement = (segment: TimelineSegment['segment']): CameraMovement => {
  if (segment.cameraMovement && segment.cameraMovement !== 'static') {
    return segment.cameraMovement;
  }

  const metadataValue = segment.metadata?.['cameraMovement'];
  return normalizeCameraMovement(metadataValue);
};

// The following B-roll related functions are commented out as B-roll placeholder functionality
// is currently bypassed. They are kept for potential future re-introduction.

// const resolveBrollSubtitle = (segment: TimelineSegment['segment']): string | undefined => {
//   const meta = segment.metadata ?? {};
//   const subtitle = meta['subtitle'] ?? meta['description'];
//   return typeof subtitle === 'string' ? subtitle : undefined;
// };
const normalizeMotionCue = (cue: unknown): MotionCue | undefined => {
  if (cue === 'zoomIn' || cue === 'zoomOut') {
    return cue;
  }

  if (typeof cue !== 'string') {
    return undefined;
  }

  const token = cue.trim().toLowerCase();
  switch (token) {
    case 'zoomin':
    case 'zoom-in':
    case 'pushin':
    case 'push':
      return 'zoomIn';
    case 'zoomout':
    case 'zoom-out':
    case 'pullback':
    case 'pull':
      return 'zoomOut';
    default:
      return undefined;
  }
};

const resolveMotionCue = (segment: TimelineSegment['segment']): MotionCue | undefined => {
  if (segment.motionCue) {
    return segment.motionCue;
  }

  const metadataValue = segment.metadata?.['motionCue'];
  return normalizeMotionCue(metadataValue);
};

//   const fallbackFromTitle = cleanTitle(segment.title ?? segment.label);
//   if (fallbackFromTitle) {
//     return fallbackFromTitle;
//   }

//   return 'keyword';
// };

// const resolveBrollMediaType = (
//   segment: TimelineSegment['segment']
// ): 'image' | 'video' => {
//   const meta = segment.metadata ?? {};
//   const possibleValues = [meta['assetType'], meta['type'], meta['mediaType'], meta['format']];

//   const toString = (value: unknown): string | undefined => {
//     if (typeof value === 'string') {
//       return value.toLowerCase();
//     }
//     return undefined;
//   };

//   for (const raw of possibleValues) {
//     const normalized = toString(raw);
//     if (!normalized) {
//       continue;
//     }
//     if (/(image|photo|picture|graphic)/.test(normalized)) {
//       return 'image';
//     }
//     if (/(video|footage|clip|broll|b-roll)/.test(normalized)) {
//       return 'video';
//     }
//   }

//   const combinedTitle = `${segment.title ?? ''} ${segment.label ?? ''}`.toLowerCase();
//   if (/(image|photo|picture|graphic)/.test(combinedTitle)) {
//     return 'image';
//   }

//   return 'video';
// };

/** Easing function for smooth animations. */
const easeInOut = Easing.bezier(0.4, 0, 0.2, 1);
interface TransformInfo {
  transformParts: string[];
  transformOrigin: string;
}

/**
 * Computes the CSS transform style for camera movement (zoom in/out).
 * @param movement The type of camera movement.
 * @param frame The current frame of the segment.
 * @param duration The total duration of the segment in frames.
 * @returns A `CSSProperties` object with the computed transform.
 */
const computeCameraTransform = (
  movement: CameraMovement,
  frame: number,
  duration: number
): TransformInfo => {
  if (movement === 'static') {
    return {
      transformParts: ['scale(1)'],
      transformOrigin: 'center center',
    };
  }

  // Calculate animation progress and eased value
  const progress = duration <= 1 ? 1 : clamp01(frame / Math.max(1, duration - 1));
  const eased = easeInOut(progress);

  // Determine start and end scale for zoom effect
  const startScale = movement === 'zoomIn' ? 1 : 1.08;
  const endScale = movement === 'zoomIn' ? 1.08 : 1;
  const scale = startScale + (endScale - startScale) * eased;

  return {
    transformParts: [`scale(${scale.toFixed(4)})`],
    transformOrigin: 'center center',
  };
};

/**
 * Props for the `SegmentClip` component.
 */
const computeMotionCueTransforms = (
  cue: MotionCue | undefined,
  frame: number,
  fps: number,
  duration: number
): string[] => {
  if (!cue) {
    return [];
  }

  const time = frame / Math.max(1, fps);
  const durationSeconds = Math.max(duration / Math.max(1, fps), 0.001);
  const progress = clamp01(time / durationSeconds);
  const eased = easeInOut(progress);

  switch (cue) {
    default:
      return [];
  }
};

const cleanTitle = (title: string | undefined): string | undefined => {
  if (!title) {
    return undefined;
  }

  const withoutParens = title.replace(/\([^)]*\)/g, '').trim();
  return withoutParens.length ? withoutParens : undefined;
};

const resolveBrollSubtitle = (segment: TimelineSegment['segment']): string | undefined => {
  const meta = segment.metadata ?? {};
  const subtitle = meta['subtitle'] ?? meta['description'] ?? meta['note'];
  return typeof subtitle === 'string' ? subtitle : undefined;
};

const resolveBrollVariant = (
  segment: TimelineSegment['segment'],
  mode: BrollMode
): 'fullwidth' | 'roundedFrame' => {
  if (mode === 'overlay' || mode === 'pictureInPicture') {
    return 'roundedFrame';
  }

  const meta = segment.metadata ?? {};
  const styleValue = meta['style'] ?? meta['variant'];
  if (typeof styleValue === 'string') {
    const normalized = styleValue.toLowerCase();
    if (normalized.includes('rounded') || normalized.includes('pip')) {
      return 'roundedFrame';
    }
  }

  return 'fullwidth';
};

const resolveBrollKeyword = (segment: TimelineSegment['segment']): string => {
  const meta = segment.metadata ?? {};
  const possibleValues = [
    meta['keyword'],
    meta['keywords'],
    meta['searchTerm'],
    meta['query'],
    meta['prompt'],
  ];

  for (const value of possibleValues) {
    if (typeof value === 'string' && value.trim().length) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      const joined = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
        .join(', ');
      if (joined.length) {
        return joined;
      }
    }
  }

  const fallbackFromTitle = cleanTitle(segment.title ?? segment.label);
  if (fallbackFromTitle) {
    return fallbackFromTitle;
  }

  return 'keyword';
};

const inferMediaTypeFromFile = (file: string | undefined): 'image' | 'video' => {
  if (!file) {
    return 'video';
  }

  const normalized = file.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(normalized)) {
    return 'image';
  }

  return 'video';
};

const resolveBrollMediaType = (segment: TimelineSegment['segment']): 'image' | 'video' => {
  const brollFile = segment.broll?.file;
  if (brollFile) {
    return inferMediaTypeFromFile(brollFile);
  }

  const meta = segment.metadata ?? {};
  const possibleValues = [meta['assetType'], meta['type'], meta['mediaType'], meta['format']];

  const toString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return undefined;
  };

  for (const raw of possibleValues) {
    const normalized = toString(raw);
    if (!normalized) {
      continue;
    }
    if (/(image|photo|picture|graphic)/.test(normalized)) {
      return 'image';
    }
    if (/(video|footage|clip|broll|b-roll)/.test(normalized)) {
      return 'video';
    }
  }

  const combinedTitle = `${segment.title ?? ''} ${segment.label ?? ''}`.toLowerCase();
  if (/(image|photo|picture|graphic)/.test(combinedTitle)) {
    return 'image';
  }

  return 'video';
};

const normalizeStaticPath = (file: string | undefined): string | undefined => {
  if (!file) {
    return undefined;
  }

  return file.replace(/^\/+/, '').replace(/^public\/+/, '');
};

const renderBrollAsset = (
  file: string | undefined,
  mediaType: 'image' | 'video',
  style: CSSProperties
): ReactNode => {
  const normalized = normalizeStaticPath(file);
  if (!normalized) {
    return null;
  }

  const source = staticFile(normalized);

  if (mediaType === 'image') {
    return <Img src={source} style={style} placeholder="" />;
  }

  return (
    <Video
      src={source}
      loop
      playbackRate={1}
      style={style}
      startFrom={0}
    />
  );
};

const buildBrollLayer = ({
  segment,
  frame,
  fps,
  duration,
}: {
  segment: TimelineSegment['segment'];
  frame: number;
  fps: number;
  duration: number;
}): ReactNode => {
  const isBrollSegment = (segment.kind ?? 'normal') === 'broll';
  const broll = segment.broll ?? undefined;
  if (!isBrollSegment && !broll) {
    return null;
  }
  const mode: BrollMode = isBrollSegment ? broll?.mode ?? 'full' : broll?.mode ?? 'overlay';
  const mediaType = resolveBrollMediaType(segment);
  const keyword = resolveBrollKeyword(segment);
  const subtitle = resolveBrollSubtitle(segment);
  const variant = resolveBrollVariant(segment, mode);
  const title = cleanTitle(segment.title ?? segment.label ?? keyword) ?? keyword;

  const appear = spring({
    frame,
    fps,
    durationInFrames: Math.min(Math.round(fps * 0.7), duration),
    config: {
      damping: 180,
      stiffness: 120,
      mass: 0.9,
    },
  });

  const exitWindow = Math.max(6, Math.round(fps * 0.6));
  const exitProgress = Math.min(1, Math.max(0, (duration - frame) / exitWindow));
  const opacity = clamp01(appear) * exitProgress;

  const overlayBase: CSSProperties = {
    position: 'absolute',
    inset: mode === 'full' ? 0 : undefined,
    bottom: mode === 'overlay' || mode === 'pictureInPicture' ? '8%' : undefined,
    right: mode === 'overlay' || mode === 'pictureInPicture' ? '6%' : undefined,
    width: mode === 'full' ? '100%' : mode === 'pictureInPicture' ? '32%' : '38%',
    aspectRatio: mediaType === 'image' ? '16 / 9' : undefined,
    maxWidth: mode === 'full' ? '100%' : '640px',
    overflow: 'hidden',
    borderRadius: mode === 'full' ? 0 : variant === 'roundedFrame' ? 32 : 12,
    boxShadow:
      mode === 'full'
        ? '0 34px 120px rgba(0,0,0,0.45)'
        : '0 24px 90px rgba(0,0,0,0.6)',
    border: mode === 'full' ? 'none' : '2px solid rgba(255,255,255,0.12)',
    transform:
      mode === 'full'
        ? `scale(${0.95 + 0.05 * appear})`
        : `translateY(${(1 - appear) * 40}px) scale(${0.85 + appear * 0.15})`,
    transformOrigin: 'center center',
    opacity,
    pointerEvents: 'none',
    backdropFilter: mode === 'full' ? undefined : 'blur(12px)',
  };

  const mediaStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  };

  const brollContent = renderBrollAsset(broll?.file, mediaType, mediaStyle);

  if (brollContent) {
    const labelStyle: CSSProperties = {
      position: 'absolute',
      left: mode === 'full' ? '6%' : '10%',
      bottom: mode === 'full' ? '6%' : '10%',
      padding: mode === 'full' ? '18px 28px' : '12px 22px',
      borderRadius: mode === 'full' ? 18 : 14,
      background: 'rgba(10, 10, 12, 0.55)',
      color: 'rgba(255,255,255,0.92)',
      fontSize: mode === 'full' ? 42 : 28,
      fontWeight: 600,
      letterSpacing: 0.4,
      textTransform: mode === 'full' ? 'uppercase' : 'none',
      backdropFilter: 'blur(6px)',
      boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
    };

    return (
      <div style={overlayBase}>
        {brollContent}
      </div>
    );
  }

  return (
    <div style={overlayBase}>
      <BrollPlaceholder
        title={title}
        subtitle={subtitle}
        keyword={keyword}
        mediaType={mediaType}
        variant={variant}
      />
    </div>
  );
};

export interface SegmentClipProps {
  /** The timeline segment data. */
  timelineSegment: TimelineSegment;
  /** The source video URL. */
  source: string;
  /** The video's frames per second. */
  fps: number;
  /** Whether audio crossfade should be applied. */
  audioCrossfade: boolean;
  /** The default duration for transitions. */
  defaultTransitionDuration: number;
}

/**
 * Renders a single video segment, applying camera movements and transitions.
 * @param props - The component props.
 */
export const SegmentClip: React.FC<SegmentClipProps> = ({
  timelineSegment,
  source,
  fps,
  audioCrossfade,
  defaultTransitionDuration,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const {segment, duration, transitionInFrames, transitionOutFrames} = timelineSegment;

  // Cap the current frame within the segment's duration
  const cappedFrame = Math.max(0, Math.min(frame, duration));

  // Apply segment transitions (visual style and audio volume)
  const {style: transitionStyle, volume} = useSegmentTransition({
    transitionIn: segment.transitionIn,
    transitionOut: segment.transitionOut,
    transitionInFrames,
    transitionOutFrames,
    frame: cappedFrame,
    durationInFrames: duration,
    width,
    height,
    fps,
    audioCrossfade,
    defaultTransitionDuration,
  });

  // Calculate video start/end frames and playback rate
  const startFrom = Math.round((segment.sourceStart ?? 0) * fps);
  const endAt = startFrom + duration;
  const playbackRate = segment.playbackRate ?? 1;

  // const isBroll = (segment.kind ?? 'normal') === 'broll'; // B-roll check (currently unused)

  // Resolve and compute camera movement style
  const cameraMovement = resolveCameraMovement(segment);
  const motionCue = resolveMotionCue(segment);
  const cameraTransform = computeCameraTransform(cameraMovement, cappedFrame, duration);
  const motionTransforms = computeMotionCueTransforms(motionCue, cappedFrame, fps, duration);
  const combinedTransforms = [...cameraTransform.transformParts, ...motionTransforms];

  const isBrollSegment = (segment.kind ?? 'normal') === 'broll';
  const shouldHideBaseVideo = isBrollSegment && (segment.broll?.mode ?? 'full') === 'full';

  // Define base container styles
  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
  };

  // Define transition container styles
  const transitionContainerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    ...transitionStyle,
    position: 'relative',
  };

  // Define video styles, including camera movement
  const videoStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    transform: combinedTransforms.join(' '),
    transformOrigin: cameraTransform.transformOrigin,
    willChange: 'transform',
    opacity: shouldHideBaseVideo ? 0 : 1,
  };

  const brollLayer = buildBrollLayer({segment, frame: cappedFrame, fps, duration});

  return (
    <div style={containerStyle}>
      <div style={transitionContainerStyle}>
        <Video
          src={source}
          startFrom={startFrom}
          endAt={endAt}
          playbackRate={playbackRate}
          volume={volume}
          style={videoStyle}
        />
        {brollLayer}
      </div>
    </div>
  );
};
