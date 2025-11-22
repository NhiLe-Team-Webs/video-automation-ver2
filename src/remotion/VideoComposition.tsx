import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
  Easing,
} from 'remotion';
import { TemplateLoader } from './templateLoader';
import { EditingPlan, ZoomEffect } from '../services/content-analysis/editingPlanService';
import { CROWN_MERCADO_BRAND } from './brandConstants';

export interface VideoCompositionProps {
  videoPath: string;
  videoDuration: number;
  videoWidth: number;
  videoHeight: number;
  editingPlan: EditingPlan;
  subtitles: SubtitleSegment[];
  brollVideos: BrollVideoMapping[];
}

export interface SubtitleSegment {
  startTime: number;
  endTime: number;
  text: string;
}

export interface BrollVideoMapping {
  startTime: number;
  duration: number;
  videoPath: string;
}

/**
 * Main video composition component
 * Combines main video, animations, B-roll, and subtitles
 */
export const VideoComposition: React.FC<VideoCompositionProps> = ({
  videoPath,
  videoDuration,
  videoWidth,
  videoHeight,
  editingPlan,
  subtitles,
  brollVideos,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Calculate zoom scale based on active zoom effects
  const zoomScale = calculateZoomScale(currentTime, editingPlan.zoomEffects || [], fps);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Main video with zoom effect */}
      {videoPath && (
        <AbsoluteFill
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'center',
          }}
        >
          <Video
            src={staticFile(videoPath)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            onError={(error) => {
              console.error('Video playback error:', error);
              // Gracefully handle video errors - don't crash the composition
            }}
          />
        </AbsoluteFill>
      )}

      {/* B-roll overlays */}
      {brollVideos.map((broll, index) => {
        const startFrame = Math.floor(broll.startTime * fps);
        const durationInFrames = Math.floor(broll.duration * fps);

        return (
          <Sequence
            key={`broll-${index}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <BrollOverlay
              videoPath={broll.videoPath}
              duration={broll.duration}
              transition={getBrollTransition(index, brollVideos.length)}
            />
          </Sequence>
        );
      })}

      {/* Highlight effects */}
      {editingPlan.highlights.map((highlight, index) => {
        const startFrame = Math.floor(highlight.startTime * fps);
        const durationInFrames = Math.floor(
          (highlight.endTime - highlight.startTime) * fps
        );

        return (
          <Sequence
            key={`highlight-${index}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <HighlightEffect
              effectType={highlight.effectType}
              parameters={highlight.parameters}
            />
          </Sequence>
        );
      })}

      {/* Animations */}
      {editingPlan.animations.map((animation, index) => {
        const startFrame = Math.floor(animation.startTime * fps);
        const durationInFrames = Math.floor(animation.duration * fps);

        const TemplateComponent = TemplateLoader.getTemplateComponent(
          animation.template as any
        );

        if (!TemplateComponent) {
          console.warn(`Template not found: ${animation.template}`);
          return null;
        }

        return (
          <Sequence
            key={`animation-${index}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <TemplateComponent
              text={animation.text || ''}
              {...animation.parameters}
            />
          </Sequence>
        );
      })}

      {/* Transitions */}
      {editingPlan.transitions.map((transition, index) => {
        const transitionFrame = Math.floor(transition.time * fps);
        const durationInFrames = Math.floor(transition.duration * fps);

        return (
          <Sequence
            key={`transition-${index}`}
            from={transitionFrame}
            durationInFrames={durationInFrames}
          >
            <TransitionEffect
              type={transition.type}
              duration={transition.duration}
            />
          </Sequence>
        );
      })}

      {/* Subtitles */}
      {subtitles.map((subtitle, index) => {
        const startFrame = Math.floor(subtitle.startTime * fps);
        const durationInFrames = Math.floor(
          (subtitle.endTime - subtitle.startTime) * fps
        );

        return (
          <Sequence
            key={`subtitle-${index}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <SubtitleOverlay text={subtitle.text} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * B-roll overlay with transition effects
 */
const BrollOverlay: React.FC<{
  videoPath: string;
  duration: number;
  transition: { type: string; duration: number };
}> = ({ videoPath, duration, transition }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = Math.floor(duration * fps);
  const transitionFrames = Math.floor(transition.duration * fps);

  // Fade in at start
  const fadeIn = interpolate(
    frame,
    [0, transitionFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Fade out at end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - transitionFrames, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      <Video
        src={staticFile(videoPath)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        onError={(error) => {
          console.error('B-roll video playback error:', error);
          // Gracefully handle B-roll errors
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Highlight effect overlay
 */
const HighlightEffect: React.FC<{
  effectType: 'zoom' | 'highlight-box' | 'text-overlay';
  parameters: Record<string, any>;
}> = ({ effectType, parameters }) => {
  const frame = useCurrentFrame();

  if (effectType === 'zoom') {
    const scale = interpolate(frame, [0, 30], [1, 1.1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      />
    );
  }

  if (effectType === 'highlight-box') {
    return (
      <AbsoluteFill
        style={{
          border: `4px solid ${CROWN_MERCADO_BRAND.colors.accentRed}`,
          margin: CROWN_MERCADO_BRAND.layout.margin.medium,
          pointerEvents: 'none',
          borderRadius: CROWN_MERCADO_BRAND.layout.borderRadius.small,
        }}
      />
    );
  }

  if (effectType === 'text-overlay') {
    return (
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(28, 16, 46, 0.9)', // Brand charcoal
            border: `2px solid ${CROWN_MERCADO_BRAND.colors.accentRed}`,
            padding: `${CROWN_MERCADO_BRAND.layout.padding.large}px ${CROWN_MERCADO_BRAND.layout.padding.large}px`,
            borderRadius: CROWN_MERCADO_BRAND.layout.borderRadius.medium,
            fontSize: CROWN_MERCADO_BRAND.typography.fontSize.headline,
            fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightBold,
            fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
            color: CROWN_MERCADO_BRAND.colors.textPrimary,
            textAlign: 'center',
          }}
        >
          {parameters.text || 'Highlight'}
        </div>
      </AbsoluteFill>
    );
  }

  return null;
};

/**
 * Transition effect
 */
const TransitionEffect: React.FC<{
  type: 'fade' | 'slide' | 'wipe';
  duration: number;
}> = ({ type, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = Math.floor(duration * fps);

  if (type === 'fade') {
    const opacity = interpolate(frame, [0, durationInFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill
        style={{
          backgroundColor: 'black',
          opacity,
        }}
      />
    );
  }

  if (type === 'slide') {
    const translateX = interpolate(
      frame,
      [0, durationInFrames],
      [-100, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }
    );

    return (
      <AbsoluteFill
        style={{
          backgroundColor: 'black',
          transform: `translateX(${translateX}%)`,
        }}
      />
    );
  }

  if (type === 'wipe') {
    const width = interpolate(frame, [0, durationInFrames], [0, 100], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill
        style={{
          backgroundColor: 'black',
          width: `${width}%`,
        }}
      />
    );
  }

  return null;
};

/**
 * Subtitle overlay
 */
const SubtitleOverlay: React.FC<{ text: string }> = ({ text }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: '80px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(28, 16, 46, 0.9)', // Brand charcoal with opacity
          border: `2px solid ${CROWN_MERCADO_BRAND.colors.accentRed}`,
          padding: `${CROWN_MERCADO_BRAND.layout.padding.medium}px ${CROWN_MERCADO_BRAND.layout.padding.large}px`,
          borderRadius: CROWN_MERCADO_BRAND.layout.borderRadius.small,
          fontSize: CROWN_MERCADO_BRAND.typography.fontSize.body,
          maxWidth: '80%',
          textAlign: 'center',
          lineHeight: '1.4',
          fontFamily: CROWN_MERCADO_BRAND.typography.bodyFont,
          fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightSemiBold,
          color: CROWN_MERCADO_BRAND.colors.textPrimary,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Calculate zoom scale based on active zoom effects
 * Implements smooth zoom in/out with configurable easing
 */
function calculateZoomScale(
  currentTime: number,
  zoomEffects: ZoomEffect[],
  fps: number
): number {
  // Find active zoom effect at current time
  const activeZoom = zoomEffects.find(
    (zoom) => currentTime >= zoom.startTime && currentTime <= zoom.endTime
  );

  if (!activeZoom) {
    return 1.0; // No zoom, normal scale
  }

  const zoomDurationSeconds = activeZoom.zoomDuration / 1000;
  const effectDuration = activeZoom.endTime - activeZoom.startTime;
  const timeInEffect = currentTime - activeZoom.startTime;

  // Zoom in phase (first zoomDuration seconds)
  if (timeInEffect <= zoomDurationSeconds) {
    const progress = timeInEffect / zoomDurationSeconds;
    return interpolate(
      progress,
      [0, 1],
      [1.0, activeZoom.targetScale],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: getEasingFunction(activeZoom.easingFunction),
      }
    );
  }

  // Hold phase (middle of effect)
  const zoomOutStartTime = activeZoom.endTime - zoomDurationSeconds;
  if (currentTime < zoomOutStartTime) {
    return activeZoom.targetScale; // Hold at target scale
  }

  // Zoom out phase (last zoomDuration seconds)
  const timeInZoomOut = currentTime - zoomOutStartTime;
  const progress = timeInZoomOut / zoomDurationSeconds;
  return interpolate(
    progress,
    [0, 1],
    [activeZoom.targetScale, 1.0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: getEasingFunction(activeZoom.easingFunction),
    }
  );
}

/**
 * Get Remotion easing function from string
 */
function getEasingFunction(easingName: string): (t: number) => number {
  switch (easingName) {
    case 'ease-in-out':
      return Easing.inOut(Easing.ease);
    case 'ease-in':
      return Easing.in(Easing.ease);
    case 'ease-out':
      return Easing.out(Easing.ease);
    case 'linear':
      return (t) => t;
    default:
      return Easing.inOut(Easing.ease);
  }
}

/**
 * Get transition for B-roll based on position
 */
function getBrollTransition(
  index: number,
  total: number
): { type: string; duration: number } {
  // First and last clips get fade transitions
  if (index === 0 || index === total - 1) {
    return { type: 'fade', duration: 0.5 };
  }

  // Middle clips alternate between fade and slide
  const transitionType = index % 2 === 0 ? 'fade' : 'slide';
  return { type: transitionType, duration: 0.3 };
}
