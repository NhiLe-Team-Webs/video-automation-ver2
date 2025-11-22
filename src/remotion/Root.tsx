import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';
import { REMOTION_CONFIG, secondsToFrames } from './config';
import * as Templates from './templates';
import { CROWN_MERCADO_BRAND } from './brandConstants';
import { CSSAnimationPreview, TransitionPreview } from './previews';

/**
 * Remotion Root Component
 * Registers all available compositions including:
 * - Templates (text animations, effects)
 * - CSS Animations (from Animate.css)
 * - Transitions (fade, slide, wipe, zoom)
 * 
 * All use Crown Mercado brand defaults but can be customized via props
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Main Video Composition - requires video file */}
      <Composition
        id="VideoComposition"
        component={VideoComposition as any}
        durationInFrames={REMOTION_CONFIG.defaultDurationInFrames}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          videoPath: '',
          videoDuration: 0,
          videoWidth: 1920,
          videoHeight: 1080,
          editingPlan: {
            highlights: [],
            animations: [],
            transitions: [],
            brollPlacements: [],
          },
          subtitles: [],
          brollVideos: [],
        }}
        calculateMetadata={({ props }: any) => {
          const durationInFrames = secondsToFrames(
            props.videoDuration || 5,
            REMOTION_CONFIG.fps
          );

          return {
            durationInFrames,
            fps: REMOTION_CONFIG.fps,
            width: props.videoWidth || REMOTION_CONFIG.width,
            height: props.videoHeight || REMOTION_CONFIG.height,
          };
        }}
      />

      {/* Individual Template Compositions - standalone previews with Crown Mercado branding */}
      <Composition
        id="AnimatedText"
        component={Templates.AnimatedText}
        durationInFrames={150}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'Crown Mercado',
          fontSize: CROWN_MERCADO_BRAND.typography.fontSize.headline,
          color: CROWN_MERCADO_BRAND.colors.textPrimary,
          accentColor: CROWN_MERCADO_BRAND.colors.accentRed,
          fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
          fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightBold,
        }}
      />

      <Composition
        id="BounceText"
        component={Templates.BounceText}
        durationInFrames={150}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          title: 'Amazing Title',
          subtitle: 'Subtitle text here',
          backgroundColor: '#1a1a1a',
        }}
      />

      <Composition
        id="SlideText"
        component={Templates.SlideText}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'Creating Brand Preference',
          fontSize: CROWN_MERCADO_BRAND.typography.fontSize.subtitle,
          color: CROWN_MERCADO_BRAND.colors.textPrimary,
          direction: 'right' as const,
          fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
          fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightBold,
        }}
      />

      <Composition
        id="PulsingText"
        component={Templates.PulsingText}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'Bold',
          fontSize: CROWN_MERCADO_BRAND.typography.fontSize.subtitle,
          color: CROWN_MERCADO_BRAND.colors.textPrimary,
          fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
          fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightBold,
        }}
      />

      <Composition
        id="BubblePopText"
        component={Templates.BubblePopText}
        durationInFrames={90}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'Pop!',
        }}
      />

      <Composition
        id="FloatingBubbleText"
        component={Templates.FloatingBubbleText}
        durationInFrames={150}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'Floating',
        }}
      />

      <Composition
        id="GlitchText"
        component={Templates.GlitchText}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'GLITCH',
          fontSize: 80,
        }}
      />

      <Composition
        id="CardFlip"
        component={Templates.CardFlip}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          frontText: 'Front',
          backText: 'Back',
          backgroundColor: '#673AB7',
        }}
      />

      <Composition
        id="AnimatedList"
        component={Templates.AnimatedList}
        durationInFrames={180}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          items: ['First Item', 'Second Item', 'Third Item', 'Fourth Item'],
        }}
      />

      <Composition
        id="GeometricPatterns"
        component={Templates.GeometricPatterns}
        durationInFrames={150}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          patternCount: 20,
          primaryColor: CROWN_MERCADO_BRAND.patterns.triangles.primary.color1,
          secondaryColor: CROWN_MERCADO_BRAND.patterns.triangles.primary.color2,
          tertiaryColor: CROWN_MERCADO_BRAND.patterns.triangles.primary.color3,
          backgroundColor: CROWN_MERCADO_BRAND.colors.charcoal,
          accentColor: CROWN_MERCADO_BRAND.colors.accentRed,
        }}
      />

      <Composition
        id="LiquidWave"
        component={Templates.LiquidWave}
        durationInFrames={180}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          numberOfPoints: 50,
          waveColor: '#00BCD4',
        }}
      />

      <Composition
        id="MatrixRain"
        component={Templates.MatrixRain}
        durationInFrames={300}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{}}
      />

      <Composition
        id="ParticleExplosion"
        component={Templates.ParticleExplosion}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'BOOM!',
          particleCount: 100,
        }}
      />

      <Composition
        id="SoundWave"
        component={Templates.SoundWave}
        durationInFrames={150}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          barCount: 50,
          color: '#E91E63',
        }}
      />

      <Composition
        id="TypewriterSubtitle"
        component={Templates.TypewriterSubtitle}
        durationInFrames={180}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'This is a typewriter effect subtitle that appears character by character.',
          fontSize: 40,
          color: '#FFFFFF',
          durationInFrames: 180,
        }}
      />

      {/* CSS Animations - Popular ones */}
      <Composition
        id="CSS-FadeIn"
        component={CSSAnimationPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          animationName: 'fadeIn',
          text: 'Fade In',
          backgroundColor: CROWN_MERCADO_BRAND.colors.charcoal,
          textColor: CROWN_MERCADO_BRAND.colors.textPrimary,
        }}
      />

      <Composition
        id="CSS-BounceIn"
        component={CSSAnimationPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          animationName: 'bounceIn',
          text: 'Bounce In',
        }}
      />

      <Composition
        id="CSS-SlideInLeft"
        component={CSSAnimationPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          animationName: 'slideInLeft',
          text: 'Slide In Left',
        }}
      />

      <Composition
        id="CSS-ZoomIn"
        component={CSSAnimationPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          animationName: 'zoomIn',
          text: 'Zoom In',
        }}
      />

      <Composition
        id="CSS-FlipInX"
        component={CSSAnimationPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          animationName: 'flipInX',
          text: 'Flip In X',
        }}
      />

      <Composition
        id="CSS-RotateIn"
        component={CSSAnimationPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          animationName: 'rotateIn',
          text: 'Rotate In',
        }}
      />

      <Composition
        id="CSS-LightSpeedInRight"
        component={CSSAnimationPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          animationName: 'lightSpeedInRight',
          text: 'Light Speed',
        }}
      />

      <Composition
        id="CSS-RubberBand"
        component={CSSAnimationPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          animationName: 'rubberBand',
          text: 'Rubber Band',
        }}
      />

      {/* Transitions */}
      <Composition
        id="Transition-Fade"
        component={TransitionPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          transitionType: 'fade' as const,
          duration: 1,
        }}
      />

      <Composition
        id="Transition-SlideLeft"
        component={TransitionPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          transitionType: 'slide' as const,
          direction: 'left' as const,
          duration: 1,
        }}
      />

      <Composition
        id="Transition-SlideRight"
        component={TransitionPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          transitionType: 'slide' as const,
          direction: 'right' as const,
          duration: 1,
        }}
      />

      <Composition
        id="Transition-SlideUp"
        component={TransitionPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          transitionType: 'slide' as const,
          direction: 'up' as const,
          duration: 1,
        }}
      />

      <Composition
        id="Transition-SlideDown"
        component={TransitionPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          transitionType: 'slide' as const,
          direction: 'down' as const,
          duration: 1,
        }}
      />

      <Composition
        id="Transition-Wipe"
        component={TransitionPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          transitionType: 'wipe' as const,
          duration: 1,
        }}
      />

      <Composition
        id="Transition-Zoom"
        component={TransitionPreview}
        durationInFrames={120}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          transitionType: 'zoom' as const,
          duration: 1,
        }}
      />
    </>
  );
};
