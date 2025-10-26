import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {HighlightPlan, HighlightTheme} from '../types';
import {renderHighlightByType} from './TextHighlightVariants';

/**
 * Props for the `HighlightCallout` component.
 */
export interface HighlightCalloutProps {
  /** The highlight plan data. */
  highlight: HighlightPlan;
  /** The total duration of the highlight in frames. */
  durationInFrames: number;
  /** Optional theme overrides for the highlight. */
  theme?: HighlightTheme;
}

/**
 * A wrapper component for rendering various text-based highlights.
 * It manages the common appearance and exit animations for highlights.
 * @param props - The component props.
 */
export const HighlightCallout: React.FC<HighlightCalloutProps> = ({
  highlight,
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  // Define the duration of appearance and exit animations in frames
  const appearFrames = Math.max(4, Math.round(fps * 0.3)); // Minimum 4 frames, or 0.3 seconds
  const exitFrames = Math.max(4, Math.round(fps * 0.25)); // Minimum 4 frames, or 0.25 seconds

  // Calculate the normalized 'appear' progress (0 to 1)
  const appear = interpolate(frame, [0, appearFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Calculate the normalized 'exit' progress (1 to 0)
  const exit = interpolate(
    frame,
    [durationInFrames - exitFrames, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Render the specific highlight type using the TextHighlightVariants renderer
  const content = renderHighlightByType({
    highlight,
    theme,
    appear,
    exit,
    width,
    height,
    frame,
    fps,
    durationInFrames,
    appearWindowInFrames: appearFrames,
  });

  return content ? <>{content}</> : null;
};
