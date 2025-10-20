import type {SegmentPlan, TransitionPlan} from '../types';

/**
 * Represents a single segment in the computed video timeline.
 */
export interface TimelineSegment {
  /** The original segment plan data. */
  segment: SegmentPlan;
  /** The start frame of this segment in the overall composition timeline. */
  from: number;
  /** The duration of this segment in frames. */
  duration: number;
  /** The duration of the incoming transition in frames. */
  transitionInFrames: number;
  /** The duration of the outgoing transition in frames. */
  transitionOutFrames: number;
  /** Whether an audio crossfade should be applied for this segment. */
  audioCrossfade: boolean;
}

/**
 * Converts a duration in seconds to frames, rounding to the nearest whole frame.
 * Ensures the result is non-negative.
 * @param seconds The duration in seconds.
 * @param fps The frames per second.
 * @returns The duration in frames.
 */
const toFrames = (seconds: number, fps: number) => Math.max(0, Math.round(seconds * fps));

/**
 * Resolves the duration of a transition in frames.
 * It uses the transition's explicit duration, falls back to a default, and clamps the result.
 * @param transition The transition plan.
 * @param fps The frames per second.
 * @param fallbackSeconds The fallback duration in seconds if not specified in the transition.
 * @param maxDurationFrames The maximum allowed duration for the transition in frames.
 * @returns The resolved transition duration in frames.
 */
const resolveTransitionDuration = (
  transition: TransitionPlan | undefined,
  fps: number,
  fallbackSeconds: number,
  maxDurationFrames: number
) => {
  if (!transition) {
    return 0;
  }

  const targetSeconds = transition.duration ?? fallbackSeconds;
  const frames = toFrames(targetSeconds, fps);
  return Math.min(Math.max(frames, 0), Math.floor(maxDurationFrames));
};

/**
 * Builds a detailed timeline of video segments from a list of `SegmentPlan`s.
 * It calculates start frames, durations, and transition timings, handling overlaps.
 * @param segments An array of `SegmentPlan` objects.
 * @param fps The frames per second of the video.
 * @param fallbackTransitionSeconds The default transition duration in seconds.
 * @returns An array of `TimelineSegment` objects.
 */
export const buildTimeline = (
  segments: SegmentPlan[],
  fps: number,
  fallbackTransitionSeconds: number
): TimelineSegment[] => {
  const timeline: TimelineSegment[] = [];

  segments.forEach((segment, index) => {
    const durationFrames = Math.max(1, toFrames(segment.duration, fps));
    const maxTransitionFrames = durationFrames / 2; // Transitions should not be longer than half the segment
    
    // Determine if transitions are allowed based on `silenceAfter` property
    const allowIn = index > 0 ? segments[index - 1].silenceAfter !== false : false;
    const allowOut = segment.silenceAfter !== false;

    const segmentForTimeline: SegmentPlan = {...segment};

    // Disable incoming transition if not allowed
    if (!allowIn) {
      segmentForTimeline.transitionIn = undefined;
    }

    // Resolve outgoing transition: prioritize explicit `transitionOut`, then `next.transitionIn`
    let effectiveOut = allowOut ? segmentForTimeline.transitionOut : undefined;
    if (allowOut && !effectiveOut) {
      const next = segments[index + 1];
      if (next?.transitionIn) {
        effectiveOut = next.transitionIn;
      }
    }
    segmentForTimeline.transitionOut = allowOut ? effectiveOut : undefined;

    // Calculate incoming and outgoing transition durations in frames
    const transitionInFrames = allowIn
      ? resolveTransitionDuration(
          segmentForTimeline.transitionIn,
          fps,
          fallbackTransitionSeconds,
          maxTransitionFrames
        )
      : 0;

    const transitionOutFrames = allowOut
      ? resolveTransitionDuration(
          segmentForTimeline.transitionOut,
          fps,
          fallbackTransitionSeconds,
          maxTransitionFrames
        )
      : 0;

    if (index === 0) {
      // First segment starts at frame 0
      timeline.push({
        segment: segmentForTimeline,
        from: 0,
        duration: durationFrames,
        transitionInFrames,
        transitionOutFrames,
        audioCrossfade: false, // No crossfade for the very first segment
      });
      return;
    }

    // For subsequent segments, calculate placement based on previous segment and transitions
    const previous = timeline[index - 1];
    const from = previous.from + previous.duration;

    timeline.push({
      segment: segmentForTimeline,
      from,
      duration: durationFrames,
      transitionInFrames,
      transitionOutFrames,
      audioCrossfade: allowIn, // Audio crossfade if incoming transition is allowed
    });
  });

  return timeline;
};

/**
 * Calculates the total duration of the entire plan in frames based on the computed timeline.
 * @param timeline An array of `TimelineSegment` objects.
 * @returns The total duration in frames.
 */
export const getPlanDuration = (timeline: TimelineSegment[]): number => {
  if (!timeline.length) {
    return 0;
  }

  const last = timeline[timeline.length - 1];
  return last.from + last.duration;
};
