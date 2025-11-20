/**
 * Glitch Text Template
 * Text with glitch/distortion effect
 * 
 * Copied from remotion-templates reference
 */

import { useCurrentFrame } from "remotion";
import React from 'react';

interface GlitchTextProps {
  text?: string;
  fontSize?: string;
}

export function GlitchText({ 
  text = "GLITCH",
  fontSize = "5rem"
}: GlitchTextProps) {
  const frame = useCurrentFrame();

  const glitchIntensity = Math.sin(frame / 10) * 10;
  const rgbOffset = Math.sin(frame / 5) * 5;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontSize,
        fontWeight: "bold",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          position: "absolute",
          color: "cyan",
          transform: `translate(${rgbOffset}px, ${glitchIntensity}px)`,
          mixBlendMode: "screen",
        }}
      >
        {text}
      </div>
      <div
        style={{
          position: "absolute",
          color: "magenta",
          transform: `translate(${-rgbOffset}px, ${-glitchIntensity}px)`,
          mixBlendMode: "screen",
        }}
      >
        {text}
      </div>
      <div style={{ color: "white", opacity: 0.8 }}>{text}</div>
    </div>
  );
}
