import React from 'react';
import {
  AbsoluteFill,
  Audio as RemotionAudio,
  Sequence,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
  Easing,
} from 'remotion';
import { TemplateLoader } from './templateLoader';
import { EditingPlan, ZoomEffect, TextHighlight, SoundEffectPlacement } from '../services/content-analysis/editingPlanService';
import { applyBrandKitToTextStyle } from './brandKitHelper';

export interface VideoCompositionProps {
  videoPath: string;
  videoDuration: number;
  videoWidth: number;
  videoHeight: number;
  editingPlan: EditingPlan;
  subtitles: SubtitleSegment[];
  brollVideos: BrollVideoMapping[];
  soundEffectPaths?: SoundEffectPathMapping[];
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

export interface SoundEffectPathMapping {
  timestamp: number;
  effectType: string;
  localPath: string;
  volume: number;
}

/**
 * Main video composition component
 * Combines main video, animations, B-roll, text highlights, and sound effects
 * 
 * Requirements implemented:
 * - 12.5: Smooth transitions (300-500ms)
 * - 13.5: Sound effects synchronized with visual elements
 * - 15.4: Zoom effects with smooth easing
 * - 16.5: Brand kit styling applied to all text
 * - 17.2: Text highlights with early timing (300ms before audio)
 * - 18.1-18.4: Only text highlights rendered (no continuous subtitles)
 * - 19.5: Cut filters applied (via FFmpeg preprocessing)
 */
export const VideoComposition: React.FC<VideoCompositionProps> = ({
  videoPath,
  videoDuration,
  videoWidth,
  videoHeight,
  editingPlan,
  subtitles,
  brollVideos,
  soundEffectPaths = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Calculate zoom scale based on active zoom effects
  const zoomScale = calculateZoomScale(currentTime, editingPlan.zoomEffects || [], fps);

  // Apply cut filters via CSS filters (basic implementation)
  // Note: Advanced color grading should be done via FFmpeg preprocessing
  const cutFilterStyle = applyCutFilters(editingPlan.cutFilters);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Main video with zoom effect and cut filters */}
      {videoPath && (
        <AbsoluteFill
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'center',
            ...cutFilterStyle,
          }}
        >
          <OffthreadVideo
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

      {/* Sound effects */}
      {soundEffectPaths.map((sfx, index) => {
        const startFrame = Math.floor(sfx.timestamp * fps);
        
        return (
          <Sequence
            key={`sfx-${index}`}
            from={startFrame}
          >
            <RemotionAudio
              src={staticFile(sfx.localPath)}
              volume={sfx.volume}
              onError={(error) => {
                console.warn('Sound effect playback error:', error);
                // Gracefully handle SFX errors - don't crash
              }}
            />
          </Sequence>
        );
      })}

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

      {/* Text Highlights (Requirements 17.2, 18.1-18.4) */}
      {/* Only render text highlights from editing plan, not continuous subtitles */}
      {editingPlan.textHighlights && editingPlan.textHighlights.map((textHighlight, index) => {
        const startFrame = Math.floor(textHighlight.startTime * fps);
        const durationInFrames = Math.floor(textHighlight.duration * fps);

        return (
          <Sequence
            key={`text-highlight-${index}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <TextHighlightOverlay textHighlight={textHighlight} />
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
      <OffthreadVideo
        src={staticFile(videoPath)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        onError={(error: any) => {
          console.error('B-roll video playback error:', error);
          // Gracefully handle B-roll errors
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Highlight effect overlay
 * Note: This is for legacy highlight effects. New implementations should use TextHighlightOverlay.
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
          border: '4px solid #E63946',
          margin: '20px',
          pointerEvents: 'none',
          borderRadius: '8px',
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
            backgroundColor: 'rgba(28, 16, 46, 0.9)',
            border: '2px solid #E63946',
            padding: '24px 40px',
            borderRadius: '12px',
            fontSize: 56,
            fontWeight: 700,
            fontFamily: 'Montserrat, sans-serif',
            color: '#FFFFFF',
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
 * Text Highlight overlay with brand kit styling
 * Requirements 16.5, 17.2, 18.3
 */
const TextHighlightOverlay: React.FC<{ textHighlight: TextHighlight }> = ({ textHighlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Apply brand kit styling to text style
  const styledText = applyBrandKitToTextStyle(textHighlight);
  
  // Animation based on style
  const opacity = getTextAnimationOpacity(frame, fps, styledText.style.animation);
  const transform = getTextAnimationTransform(frame, fps, styledText.style.animation);

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
          backgroundColor: styledText.style.backgroundColor || 'rgba(28, 16, 46, 0.9)',
          padding: '20px 40px',
          borderRadius: '12px',
          fontSize: styledText.style.fontSize,
          fontWeight: styledText.style.fontWeight,
          fontFamily: styledText.style.fontFamily,
          color: styledText.style.color,
          textAlign: 'center',
          maxWidth: '80%',
          lineHeight: '1.4',
          opacity,
          transform,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        {textHighlight.text}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Get opacity for text animation
 */
function getTextAnimationOpacity(
  frame: number,
  fps: number,
  animation: string
): number {
  const fadeInFrames = Math.floor(0.3 * fps); // 300ms fade in
  
  if (animation === 'fade-in') {
    return interpolate(
      frame,
      [0, fadeInFrames],
      [0, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }
    );
  }
  
  // For other animations, still apply a quick fade in
  if (frame < fadeInFrames) {
    return interpolate(
      frame,
      [0, fadeInFrames],
      [0, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }
    );
  }
  
  return 1;
}

/**
 * Get transform for text animation
 */
function getTextAnimationTransform(
  frame: number,
  fps: number,
  animation: string
): string {
  const animationFrames = Math.floor(0.5 * fps); // 500ms animation
  
  if (animation === 'slide-up') {
    const translateY = interpolate(
      frame,
      [0, animationFrames],
      [50, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.ease),
      }
    );
    return `translateY(${translateY}px)`;
  }
  
  if (animation === 'pop') {
    const scale = interpolate(
      frame,
      [0, animationFrames / 2, animationFrames],
      [0.5, 1.1, 1.0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.ease),
      }
    );
    return `scale(${scale})`;
  }
  
  return 'none';
}

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

/**
 * Apply cut filters as CSS filters
 * Requirements 19.1-19.5
 * 
 * Note: This provides basic CSS filter support.
 * For professional color grading, FFmpeg preprocessing is recommended.
 */
function applyCutFilters(cutFilters?: any): React.CSSProperties {
  if (!cutFilters) {
    return {};
  }

  const filters: string[] = [];

  // Apply color grading
  if (cutFilters.colorGrading) {
    const { contrast, saturation } = cutFilters.colorGrading;
    
    if (contrast !== undefined && contrast !== 1.0) {
      filters.push(`contrast(${contrast})`);
    }
    
    if (saturation !== undefined && saturation !== 1.0) {
      filters.push(`saturate(${saturation})`);
    }
  }

  // Apply sharpening (not directly supported in CSS, but we can use contrast)
  if (cutFilters.applySharpening && cutFilters.sharpeningIntensity) {
    // Sharpening approximation via contrast
    const sharpenContrast = 1.0 + (cutFilters.sharpeningIntensity * 0.1);
    if (!filters.some(f => f.startsWith('contrast'))) {
      filters.push(`contrast(${sharpenContrast})`);
    }
  }

  // Apply vignette (requires box-shadow or radial gradient overlay)
  // This is handled separately via overlay component if needed

  return {
    filter: filters.length > 0 ? filters.join(' ') : undefined,
  };
}
