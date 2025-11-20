/**
 * Slide Text Template
 * Text sliding in from the side with fade effect
 * 
 * Copied from remotion-templates reference
 */

import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface SlideTextProps {
  text?: string;
  fontSize?: string;
  color?: string;
  direction?: 'left' | 'right';
}

export function SlideText({ 
  text = "Sliding Text!", 
  fontSize = "4rem",
  color = "white",
  direction = 'right'
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
          fontWeight: "bold",
        }}
      >
        {text}
      </h1>
    </div>
  );
}
