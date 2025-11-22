/**
 * Animated Text Template
 * Character-by-character animated text with spring physics
 *
 * Crown Mercado branded with bold typography and accent colors
 */

import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CROWN_MERCADO_BRAND } from '../brandConstants';

interface AnimatedTextProps {
  text?: string;
  fontSize?: string;
  color?: string;
}

export function AnimatedText({
  text = "Crown Mercado",
  fontSize = CROWN_MERCADO_BRAND.typography.fontSize.headline,
  color = CROWN_MERCADO_BRAND.colors.textPrimary
}: AnimatedTextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const characters = text.split("");

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        textAlign: "center",
      }}
    >
      {characters.map((char, i) => {
        const delay = i * 5;

        const opacity = spring({
          frame: frame - delay,
          fps,
          from: 0,
          to: 1,
          config: CROWN_MERCADO_BRAND.timing.spring,
        });

        const y = spring({
          frame: frame - delay,
          fps,
          from: -50,
          to: 0,
          config: CROWN_MERCADO_BRAND.timing.spring,
        });

        const rotate = spring({
          frame: frame - delay,
          fps,
          from: -180,
          to: 0,
          config: { ...CROWN_MERCADO_BRAND.timing.spring, damping: 15 },
        });

        // Apply accent color to specific characters for emphasis
        const charColor = i % 7 === 0 ? CROWN_MERCADO_BRAND.colors.accentRed : color;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              color: charColor,
              fontSize,
              fontFamily: CROWN_MERCADO_BRAND.typography.headlineFont,
              fontWeight: CROWN_MERCADO_BRAND.typography.fontWeightBold,
              transform: `translateY(${y}px) rotate(${rotate}deg)`,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </div>
  );
}
