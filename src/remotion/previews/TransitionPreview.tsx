/**
 * Transition Preview Component
 * 
 * Preview transitions in Remotion Studio
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { CROWN_MERCADO_BRAND } from '../brandConstants';

interface TransitionPreviewProps {
  transitionType?: 'fade' | 'slide' | 'wipe' | 'zoom';
  direction?: 'left' | 'right' | 'up' | 'down';
  duration?: number; // in seconds
}

export const TransitionPreview: React.FC<TransitionPreviewProps> = ({
  transitionType = 'fade',
  direction = 'right',
  duration = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = Math.floor(duration * fps);

  // Scene 1: Crown Mercado branding
  const Scene1 = () => (
    <AbsoluteFill
      style={{
        backgroundColor: CROWN_MERCADO_BRAND.colors.charcoal,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: CROWN_MERCADO_BRAND.typography.fontSize.headline,
          fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
          fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightBold,
          color: CROWN_MERCADO_BRAND.colors.textPrimary,
        }}
      >
        Crown Mercado
      </div>
    </AbsoluteFill>
  );

  // Scene 2: Creating Brand Preference
  const Scene2 = () => (
    <AbsoluteFill
      style={{
        backgroundColor: CROWN_MERCADO_BRAND.colors.primaryRed,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: CROWN_MERCADO_BRAND.typography.fontSize.subtitle,
          fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
          fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightBold,
          color: CROWN_MERCADO_BRAND.colors.white,
          textAlign: 'center',
        }}
      >
        Creating Brand Preference
      </div>
    </AbsoluteFill>
  );

  // Render transition based on type
  if (transitionType === 'fade') {
    const opacity = interpolate(
      frame,
      [30, 30 + durationInFrames],
      [1, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }
    );

    return (
      <>
        <Scene2 />
        <AbsoluteFill style={{ opacity }}>
          <Scene1 />
        </AbsoluteFill>
        <TransitionLabel transitionType={transitionType} />
      </>
    );
  }

  if (transitionType === 'slide') {
    let translateX = 0;
    let translateY = 0;

    if (direction === 'left') {
      translateX = interpolate(
        frame,
        [30, 30 + durationInFrames],
        [0, -100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    } else if (direction === 'right') {
      translateX = interpolate(
        frame,
        [30, 30 + durationInFrames],
        [0, 100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    } else if (direction === 'up') {
      translateY = interpolate(
        frame,
        [30, 30 + durationInFrames],
        [0, -100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    } else if (direction === 'down') {
      translateY = interpolate(
        frame,
        [30, 30 + durationInFrames],
        [0, 100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    }

    return (
      <>
        <Scene2 />
        <AbsoluteFill
          style={{
            transform: `translate(${translateX}%, ${translateY}%)`,
          }}
        >
          <Scene1 />
        </AbsoluteFill>
        <TransitionLabel transitionType={transitionType} direction={direction} />
      </>
    );
  }

  if (transitionType === 'wipe') {
    const width = interpolate(
      frame,
      [30, 30 + durationInFrames],
      [0, 100],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
      <>
        <Scene1 />
        <AbsoluteFill
          style={{
            width: `${width}%`,
            overflow: 'hidden',
          }}
        >
          <Scene2 />
        </AbsoluteFill>
        <TransitionLabel transitionType={transitionType} />
      </>
    );
  }

  if (transitionType === 'zoom') {
    const scale = interpolate(
      frame,
      [30, 30 + durationInFrames],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const opacity = interpolate(
      frame,
      [30, 30 + durationInFrames],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
      <>
        <Scene2 />
        <AbsoluteFill
          style={{
            transform: `scale(${scale})`,
            opacity,
          }}
        >
          <Scene1 />
        </AbsoluteFill>
        <TransitionLabel transitionType={transitionType} />
      </>
    );
  }

  return <Scene1 />;
};

// Transition label component
const TransitionLabel: React.FC<{
  transitionType: string;
  direction?: string;
}> = ({ transitionType, direction }) => (
  <div
    style={{
      position: 'absolute',
      bottom: '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: CROWN_MERCADO_BRAND.colors.accentRed,
      color: CROWN_MERCADO_BRAND.colors.white,
      padding: `${CROWN_MERCADO_BRAND.layout.padding.small} ${CROWN_MERCADO_BRAND.layout.padding.medium}`,
      borderRadius: CROWN_MERCADO_BRAND.layout.borderRadius.small,
      fontSize: CROWN_MERCADO_BRAND.typography.fontSize.body,
      fontFamily: CROWN_MERCADO_BRAND.typography.bodyFont,
      fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightSemiBold,
    }}
  >
    {transitionType}
    {direction && ` - ${direction}`}
  </div>
);
