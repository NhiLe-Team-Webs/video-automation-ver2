import {AbsoluteFill, Sequence} from 'remotion';
import type {HighlightPlan, HighlightTheme} from '../types';
import {HighlightCallout} from './HighlightCallout';
import {IconEffect} from './IconEffect';

/**
 * Props for the `HighlightsLayer` component.
 */
interface HighlightsLayerProps {
  /** An array of highlight plan data. */
  highlights: HighlightPlan[];
  /** The video's frames per second. */
  fps: number;
  /** Optional theme overrides for highlights. */
  theme?: HighlightTheme;
}

/**
 * Renders all highlights for the composition.
 * It iterates through the `highlights` array and renders either an `IconEffect`
 * or a `HighlightCallout` based on the highlight's type.
 * @param props - The component props.
 */
export const HighlightsLayer: React.FC<HighlightsLayerProps> = ({highlights, fps, theme}) => {
  return (
    <AbsoluteFill pointerEvents="none">
      {highlights.map((highlight) => {
        // Calculate start frame and duration for each highlight
        const from = Math.round(highlight.start * fps);
        const duration = Math.max(1, Math.round(highlight.duration * fps));
        // Determine if the highlight is an icon type
        const isIcon = (highlight.type ?? 'noteBox') === 'icon';
        
        return (
          <Sequence key={highlight.id} from={from} durationInFrames={duration} name={`highlight-${highlight.id}`}>
            {isIcon ? (
              // Render IconEffect for icon highlights
              <IconEffect highlight={highlight} durationInFrames={duration} theme={theme} />
            ) : (
              // Render HighlightCallout for other text-based highlights
              <HighlightCallout highlight={highlight} durationInFrames={duration} theme={theme} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
