/**
 * Geometric Patterns Template
 * Animated geometric patterns background with Crown Mercado triangle motifs
 *
 * Layered triangles in red gradients (futuristic + dynamic)
 * Supports brand kit customization
 */

import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import React from 'react';
import { CROWN_MERCADO_BRAND } from '../brandConstants';

interface GeometricPatternsProps {
  patternCount?: number;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  backgroundColor?: string;
  accentColor?: string;
}

export function GeometricPatterns({
  patternCount = 20,
  primaryColor = CROWN_MERCADO_BRAND.patterns.triangles.primary.color1,
  secondaryColor = CROWN_MERCADO_BRAND.patterns.triangles.primary.color2,
  tertiaryColor = CROWN_MERCADO_BRAND.patterns.triangles.primary.color3,
  backgroundColor = CROWN_MERCADO_BRAND.colors.charcoal,
  accentColor = CROWN_MERCADO_BRAND.colors.accentRed,
}: GeometricPatternsProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const patterns = Array.from({ length: patternCount }).map((_, i) => {
    const rotation = spring({
      frame: frame - i * 3,
      fps: 30,
      from: 0,
      to: 360,
      config: { damping: 100 },
    });

    const scale = spring({
      frame: frame - i * 3,
      fps: 30,
      from: 0.5,
      to: 1,
      config: CROWN_MERCADO_BRAND.timing.spring,
    });

    // Create triangle pattern using CSS clip-path
    const triangleSize = 60 + (i % 3) * 20; // Varying sizes
    const trianglePosition = {
      x: 20 + (i % 5) * 15, // Distribute across screen
      y: 20 + Math.floor(i / 5) * 15, // Distribute down screen
    };

    return { rotation, scale, index: i, triangleSize, trianglePosition };
  });

  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(135deg, ${backgroundColor}, ${primaryColor})`,
        overflow: "hidden",
      }}
    >
      {patterns.map(({ rotation, scale, index, triangleSize, trianglePosition }) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: `${trianglePosition.x}%`,
            top: `${trianglePosition.y}%`,
            width: `${triangleSize}px`,
            height: `${triangleSize}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
            // Create triangle using clip-path
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            // Apply gradient colors to triangles (customizable via brand kit)
            background: `linear-gradient(45deg, ${primaryColor}, ${secondaryColor}, ${tertiaryColor})`,
            opacity: 0.8 + (index % 3) * 0.1, // Varying opacity for depth
            border: `2px solid ${accentColor}`,
          }}
        />
      ))}
    </div>
  );
}
