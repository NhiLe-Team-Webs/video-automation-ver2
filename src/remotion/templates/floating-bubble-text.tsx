/**
 * Floating Bubble Text Template
 * Text with floating bubble effect
 * 
 * Copied from remotion-templates reference
 */

import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface FloatingBubbleTextProps {
  text?: string;
}

export function FloatingBubbleText({ 
  text = "Floating"
}: FloatingBubbleTextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const float = Math.sin(frame / 30) * 20;
  const scale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
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
        transform: `translate(-50%, -50%) translateY(${float}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          fontSize: "4.5rem",
          fontWeight: "bold",
          color: "white",
          padding: "2rem 3.5rem",
          borderRadius: "24px",
          background: "linear-gradient(45deg, #1e3a8a, #3b82f6)",
          border: "3px solid rgba(255, 255, 255, 0.3)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(30, 58, 138, 0.2)",
        }}
      >
        {text}
      </div>
    </div>
  );
}
