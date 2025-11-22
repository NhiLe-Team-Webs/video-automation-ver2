/**
 * Slide Text Template
 * Text sliding in from the side with fade effect
 * 
 * Supports brand kit customization with Crown Mercado defaults
 */

import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CROWN_MERCADO_BRAND } from '../brandConstants';

interface SlideTextProps {
  text?: string;
  fontSize?: string;
  color?: string;
  direction?: 'left' | 'right';
  fontFamily?: string;
  fontWeight?: string | number;
}

export function SlideText({ 
  text = "Sliding Text!", 
  fontSize = CROWN_MERCADO_BRAND.typography.fontSize.subtitle,
  color = CROWN_MERCADO_BRAND.colors.textPrimary,
  direction = 'right',
  fontFamily = CROWN_MERCADO_BRAND.typography.headlineFont,
  fontWeight = CROWN_MERCADO_BRAND.typography.fontWeightBold,
}: SlideTextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 30,
  });

  const slideX = spring({
    frame,
    fps,
    from: direction === 'right' ? 200 : -200,
    to: 0,
    durationInFrames: 30,
    config: {
      damping: 12,
      mass: 0.5,
    },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) translateX(${slideX}px)`,
        width: "100%",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          opacity,
          color,
          fontSize,
          fontFamily,
          fontWeight,
        }}
      >
        {text}
      </h1>
    </div>
  );
}
