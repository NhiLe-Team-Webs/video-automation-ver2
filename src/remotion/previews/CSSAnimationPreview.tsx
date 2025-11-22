/**
 * CSS Animation Preview Component
 * 
 * Preview CSS animations from Animate.css in Remotion Studio
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { CROWN_MERCADO_BRAND } from '../brandConstants';

interface CSSAnimationPreviewProps {
  animationName?: string;
  text?: string;
  backgroundColor?: string;
  textColor?: string;
}

export const CSSAnimationPreview: React.FC<CSSAnimationPreviewProps> = ({
  animationName = 'fadeIn',
  text = 'Crown Mercado',
  backgroundColor = CROWN_MERCADO_BRAND.colors.charcoal,
  textColor = CROWN_MERCADO_BRAND.colors.textPrimary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Trigger animation at start
  const shouldAnimate = frame < fps * 2; // Animate for 2 seconds

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        className={shouldAnimate ? `animate__animated animate__${animationName}` : ''}
        style={{
          fontSize: CROWN_MERCADO_BRAND.typography.fontSize.headline,
          fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
          fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightBold,
          color: textColor,
          padding: CROWN_MERCADO_BRAND.layout.padding.large,
          textAlign: 'center',
        }}
      >
        {text}
      </div>

      {/* Animation name label */}
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
        {animationName}
      </div>
    </AbsoluteFill>
  );
};
