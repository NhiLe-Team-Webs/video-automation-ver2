import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';
import { REMOTION_CONFIG, secondsToFrames } from './config';
import * as Templates from './templates';

/**
 * Remotion Root Component
 * Registers all available compositions including individual templates
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

      {/* Individual Template Compositions - standalone previews */}
      <Composition
        id="AnimatedText"
        component={Templates.AnimatedText}
        durationInFrames={150}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          text: 'Hello World',
          fontSize: 80,
          color: '#4CAF50',
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
          text: 'Sliding Text',
          fontSize: 60,
          color: '#FF5722',
          direction: 'left',
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
          text: 'Pulsing Effect',
          fontSize: 70,
          color: '#2196F3',
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
    </>
  );
};
