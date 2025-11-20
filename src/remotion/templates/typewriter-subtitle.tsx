/**
 * Typewriter Subtitle Template
 * Typewriter effect for subtitles with blinking cursor
 * 
 * Copied from remotion-templates reference
 */

import React from 'react';
import { interpolate, useCurrentFrame } from "remotion";
interface TypewriterSubtitleProps {
  text?: string;
  fontSize?: string;
  color?: string;
  durationInFrames?: number;
}

export function TypewriterSubtitle({ 
  text = "I like typing...", 
  fontSize = "3rem",
  color = "white",
  durationInFrames = 45
}: TypewriterSubtitleProps) {
  const frame = useCurrentFrame();

  const visibleCharacters = Math.floor(
    interpolate(frame, [0, durationInFrames], [0, text.length], {
      extrapolateRight: "clamp",
    })
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      {text
        .slice(0, visibleCharacters)
        .split("")
        .map((char, index) => (
          <span
            key={index}
            style={{
              display: "inline-block",
              fontFamily: "'Courier New', monospace",
              fontSize,
              fontWeight: "bold",
              color,
              transition: "all 0.05s ease-out",
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      <span
        style={{
          fontSize,
          color: "#60a5fa",
          opacity: frame % 15 < 7 ? 1 : 0,
          marginLeft: "0.2rem",
          verticalAlign: "middle",
        }}
      >
        ▌
      </span>
    </div>
  );
}
