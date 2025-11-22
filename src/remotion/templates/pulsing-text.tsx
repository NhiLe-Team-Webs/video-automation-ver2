/**
 * Pulsing Text Template
 * Text with pulsing animation effect
 * 
 * Supports brand kit customization with Crown Mercado defaults
 */

import React from 'react';
import { interpolate, useCurrentFrame } from "remotion";
import { CROWN_MERCADO_BRAND } from '../brandConstants';

interface PulsingTextProps {
  text?: string;
  fontSize?: string;
  color?: string;
  fontFamily?: string;
  fontWeight?: string | number;
}

export function PulsingText({ 
  text = "Pulse", 
  fontSize = CROWN_MERCADO_BRAND.typography.fontSize.subtitle,
  color = CROWN_MERCADO_BRAND.colors.textPrimary,
  fontFamily = CROWN_MERCADO_BRAND.typography.headlineFont,
  fontWeight = CROWN_MERCADO_BRAND.typography.fontWeightBold,
}: PulsingTextProps) {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        gap: "1rem",
      }}
    >
      {text.split("").map((char, i) => {
        const delay = i * 6;
        const pulse = interpolate(
          ((frame - delay) % 30) / 30,
          [0, 0.5, 1],
          [1, 1.2, 1],
          {
            extrapolateRight: "clamp",
          }
        );

        const opacity = interpolate(
          ((frame - delay) % 30) / 30,
          [0, 0.5, 1],
          [0.5, 1, 0.5],
          {
            extrapolateRight: "clamp",
          }
        );

        return (
          <div
            key={i}
            style={{
              position: "relative",
              transform: `scale(${pulse})`,
            }}
          >
            <span
              style={{
                fontSize,
                fontFamily,
                fontWeight,
                color,
                position: "relative",
                zIndex: 2,
              }}
            >
              {char}
            </span>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "80px",
                height: "80px",
                background: "rgba(255, 255, 255, 0.2)",
                borderRadius: "50%",
                filter: "blur(20px)",
                opacity: opacity,
                zIndex: 1,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
