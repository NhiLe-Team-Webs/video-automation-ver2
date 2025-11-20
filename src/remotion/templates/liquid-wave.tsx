/**
 * Liquid Wave Template
 * Animated liquid wave effect
 * 
 * Copied from remotion-templates reference
 */

import { useCurrentFrame, useVideoConfig } from "remotion";
import React from 'react';

interface LiquidWaveProps {
  numberOfPoints?: number;
  waveColor?: string;
}

export function LiquidWave({ 
  numberOfPoints = 50,
  waveColor = "#3b82f6"
}: LiquidWaveProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const points = Array.from({ length: numberOfPoints + 1 }).map((_, i) => {
    const x = (i / numberOfPoints) * width;
    const waveHeight = Math.sin(frame / 20 + i / 5) * 50;
    const y = height / 2 + waveHeight;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} style={{ background: "#111827" }}>
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor={waveColor} />
        </linearGradient>
      </defs>
      <path
        d={`M 0,${height} ${points.join(" ")} ${width},${height} Z`}
        fill="url(#gradient)"
        style={{
          filter: "blur(10px)",
        }}
      />
    </svg>
  );
}
