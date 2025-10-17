import {useMemo} from 'react';
import type {CSSProperties} from 'react';
import {Easing, useCurrentFrame, useVideoConfig, Video} from 'remotion';
import type {TimelineSegment} from './timeline';
import type {CameraMovement} from '../types';
import {useSegmentTransition} from './Transitions';
// import {BrollPlaceholder} from './BrollPlaceholder';

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

// const resolveBrollVariant = (segment: TimelineSegment['segment']): 'fullwidth' | 'roundedFrame' => {
//   const meta = segment.metadata ?? {};
//   const styleValue = meta['style'] ?? meta['variant'];
//   if (typeof styleValue === 'string') {
//     const normalized = styleValue.toLowerCase();
//     if (normalized.includes('rounded')) {
//       return 'roundedFrame';
//     }
//   }
//   return 'fullwidth';
// };

// const cleanTitle = (title: string | undefined): string | undefined => {
//   if (!title) {
//     return undefined;
//   }

//   const withoutParens = title.replace(/\([^)]*\)/g, '').trim();
//   return withoutParens.length ? withoutParens : undefined;
// };

// const resolveBrollKeyword = (segment: TimelineSegment['segment']): string => {
//   const meta = segment.metadata ?? {};
//   const possibleValues = [
//     meta['keyword'],
//     meta['keywords'],
//     meta['searchTerm'],
//     meta['query'],
//     meta['prompt'],
//   ];

//   for (const value of possibleValues) {
//     if (typeof value === 'string' && value.trim().length) {
//       return value.trim();
//     }
//     if (Array.isArray(value)) {
//       const joined = value
//         .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
//         .filter(Boolean)
//         .join(', ');
//       if (joined.length) {
//         return joined;
//       }
//     }
//   }

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
): CSSProperties => {
  if (movement === 'static') {
    return {
      transform: 'scale(1)',
      transformOrigin: 'center center',
      willChange: 'transform',
    };
  }

  // Calculate animation progress and eased value
  const progress = duration <= 1 ? 1 : clamp01(frame / Math.max(1, duration - 1));
  const eased = easeInOut(progress);
  
  // Determine start and end scale for zoom effect
  const startScale = movement === 'zoomIn' ? 1 : 1.08;
  const endScale = movement === 'zoomIn' ? 1.08 : 1;
  const scale = startScale + (endScale - startScale) * eased;
  
  // Add a subtle vertical drift for a more dynamic feel
  const driftDirection = movement === 'zoomIn' ? -1 : 1;
  const drift = Math.sin(eased * Math.PI) * 12 * driftDirection;

  const transformParts = [`scale(${scale})`];
  if (Math.abs(drift) > 0.1) {
    transformParts.push(`translateY(${drift}px)`);
  }

  return {
    transform: transformParts.join(' '),
    transformOrigin: 'center center',
    willChange: 'transform',
  };
};

/**
 * Props for the `SegmentClip` component.
 */
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
  const cameraStyle = useMemo(
    () => computeCameraTransform(cameraMovement, cappedFrame, duration),
    [cameraMovement, cappedFrame, duration]
  );

  // Define base container styles
  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  };

  // Define transition container styles
  const transitionContainerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    ...transitionStyle,
  };

  // Define video styles, including camera movement
  const videoStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    ...cameraStyle,
  };

  return (
    <div style={containerStyle}>
      <div style={transitionContainerStyle}>
        {/* Tạm thời bỏ qua placeholder B-roll, luôn phát footage gốc */}
        <Video
          src={source}
          startFrom={startFrom}
          endAt={endAt}
          playbackRate={playbackRate}
          volume={volume}
          style={videoStyle}
        />
      </div>
    </div>
  );
};
