/**
 * Animated Text Template
 * Character-by-character animated text with spring physics
 * 
 * Copied from remotion-templates reference
 */

import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface AnimatedTextProps {
  text?: string;
  fontSize?: string;
  color?: string;
}

export function AnimatedText({ 
  text = "Hello Remotion", 
  fontSize = "5rem",
  color = "white" 
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
          config: { mass: 0.5, damping: 10 },
        });

        const y = spring({
          frame: frame - delay,
          fps,
          from: -50,
          to: 0,
          config: { mass: 0.5, damping: 10 },
        });

        const rotate = spring({
          frame: frame - delay,
          fps,
          from: -180,
          to: 0,
          config: { mass: 0.5, damping: 12 },
        });

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              color,
              fontSize,
              fontWeight: "bold",
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
