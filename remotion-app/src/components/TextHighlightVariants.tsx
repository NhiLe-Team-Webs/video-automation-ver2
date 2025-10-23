import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {BRAND} from '../config';
import type {HighlightPlan, HighlightTheme, HighlightType} from '../types';

/** Easing function for smooth animations. */
const ease = Easing.bezier(0.42, 0, 0.58, 1);

/**
 * Context interface for highlight rendering functions.
 */
interface HighlightRenderContext {
  /** The highlight plan data. */
  highlight: HighlightPlan;
  /** Normalized progress (0-1) of the highlight's appearance animation. */
  appear: number;
  /** Normalized progress (0-1) of the highlight's exit animation. */
  exit: number;
  /** Optional theme overrides for the highlight. */
  theme?: HighlightTheme;
  /** The width of the video composition. */
  width: number;
  /** The height of the video composition. */
  height: number;
}

/**
 * Type definition for a function that renders a highlight.
 */
type HighlightRenderer = (context: HighlightRenderContext) => ReactNode;

/**
 * Clamps a number between 0 and 1.
 * @param value The number to clamp.
 * @returns The clamped number.
 */
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const withAlpha = (color: string | undefined, alpha: number, fallback: string) => {
  if (!color) {
    return fallback;
  }

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
  }

  return fallback;
};

const coerceText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const readStringFromRecord = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    if (key in record) {
      const value = coerceText(record[key]);
      if (value) {
        return value;
      }
    }
  }

  return undefined;
};

const resolveCornerTexts = (highlight: HighlightPlan): {left?: string; right?: string} => {
  const result: {left?: string; right?: string} = {};
  const highlightRecord = highlight as Record<string, unknown>;

  const rawContent = highlightRecord.content;
  if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    const record = rawContent as Record<string, unknown>;
    result.left = readStringFromRecord(record, ['top_left', 'topLeft', 'left', 'primary']);
    result.right = readStringFromRecord(record, ['top_right', 'topRight', 'right', 'secondary']);

    if (!result.left && Array.isArray(record.items)) {
      result.left = coerceText(record.items[0]);
      result.right = result.right ?? coerceText(record.items[1]);
    }
  }

  const supporting = highlight.supportingTexts as Record<string, unknown> | undefined;
  if (supporting) {
    result.left =
      result.left ?? readStringFromRecord(supporting, ['topLeft', 'top_left', 'left', 'primary']);
    result.right =
      result.right ?? readStringFromRecord(supporting, ['topRight', 'top_right', 'right', 'secondary']);
  }

  result.left =
    result.left ??
    readStringFromRecord(highlightRecord, ['supportingLeft', 'supportLeft', 'supporting']);
  result.right =
    result.right ??
    readStringFromRecord(highlightRecord, ['supportingRight', 'supportRight', 'secondary']);

  const metadata = highlightRecord.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const metadataRecord = metadata as Record<string, unknown>;
    result.left =
      result.left ?? readStringFromRecord(metadataRecord, ['top_left', 'topLeft', 'left']);
    result.right =
      result.right ?? readStringFromRecord(metadataRecord, ['top_right', 'topRight', 'right']);
  }

  if (!result.left && !result.right) {
    const fallback =
      coerceText(highlight.keyword) ??
      coerceText(highlight.text) ??
      coerceText(highlight.title) ??
      coerceText(highlight.subtitle);

    if (fallback) {
      const side = (highlight.side ?? '').toLowerCase();
      if (side === 'right') {
        result.right = fallback;
      } else if (side === 'left') {
        result.left = fallback;
      } else {
        result.left = fallback;
      }
    }
  }

  return result;
};

const renderCornerHighlights: HighlightRenderer = ({highlight, appear, exit, theme}) => {
  const corners = resolveCornerTexts(highlight);
  const left = corners.left;
  const right = corners.right;

  if (!left && !right) {
    return null;
  }

  const eased = ease(clamp01(appear));
  const exitEased = clamp01(exit);
  const fontSize = (typeof highlight.fontSize === 'number' || typeof highlight.fontSize === 'string'
    ? highlight.fontSize
    : 60) as number | string;
  const fontWeight = (typeof highlight.fontWeight === 'number' || typeof highlight.fontWeight === 'string'
    ? highlight.fontWeight
    : 900) as number | string;
  const letterSpacing =
    typeof (highlight as Record<string, unknown>).letterSpacing === 'number'
      ? ((highlight as Record<string, unknown>).letterSpacing as number)
      : 1.1;
  const textTransform =
    typeof (highlight as Record<string, unknown>).textTransform === 'string'
      ? ((highlight as Record<string, unknown>).textTransform as CSSProperties['textTransform'])
      : 'uppercase';

  const baseStyle: CSSProperties = {
    fontFamily: theme?.fontFamily ?? BRAND.fonts.heading,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight: 1.02,
    textTransform,
    color: theme?.textColor ?? BRAND.white,
    textRendering: 'geometricPrecision',
    whiteSpace: 'pre-wrap',
    opacity: exitEased,
    transform: `translateY(${(1 - eased) * 8}px)`,
  };

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
      }}
    >
      {left ? (
        <span
          style={{
            ...baseStyle,
            position: 'absolute',
            top: '6%',
            left: '6%',
            maxWidth: '32%',
            textAlign: 'left',
          }}
        >
          {left}
        </span>
      ) : null}
      {right ? (
        <span
          style={{
            ...baseStyle,
            position: 'absolute',
            top: '6%',
            right: '6%',
            maxWidth: '32%',
            textAlign: 'right',
          }}
        >
          {right}
        </span>
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Renders a 'typewriter' style highlight.
 * Text appears character by character with a blinking caret.
 * @param context The highlight render context.
 * @returns A ReactNode representing the typewriter highlight.
 */
const renderTypewriter: HighlightRenderer = (context) => renderCornerHighlights(context);

/**
 * Renders a 'noteBox' style highlight.
 * A box with text that slides in from a specified side.
 * @param context The highlight render context.
 * @returns A ReactNode representing the note box highlight.
 */
const renderNoteBox: HighlightRenderer = (context) => renderCornerHighlights(context);

/**
 * Renders a 'sectionTitle' style highlight.
 * A full-screen title card with background effects.
 * @param context The highlight render context.
 * @returns A ReactNode representing the section title highlight.
 */
const renderSectionTitle: HighlightRenderer = ({highlight, appear, exit, theme}) => {
  const title = highlight.title ?? highlight.text ?? '';
  if (!title) {
    return null;
  }

  // Determine background gradient based on variant
  const backgroundVariant = (highlight.variant ?? '').toLowerCase();
  const baseGradient =
    backgroundVariant === 'black'
      ? `linear-gradient(140deg, rgba(28,28,28,0.95) 0%, rgba(12,12,12,0.98) 100%)`
      : BRAND.gradient;

  const eased = ease(clamp01(appear));
  const exitEased = clamp01(exit);
  // Subtle scale animation for appearance/exit
  const scale = 1 + (1 - exitEased) * 0.015 + (1 - eased) * 0.015;

  const accent = highlight.accentColor ?? theme?.accentColor ?? BRAND.primary;
  const accentSoft = withAlpha(accent, 0.28, 'rgba(255, 255, 255, 0.25)');

  const container: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme?.textColor ?? BRAND.white,
    background: baseGradient,
    transform: `scale(${scale})`,
    opacity: exitEased,
    textAlign: 'center',
    boxShadow: '0 24px 120px rgba(12,12,12,0.32)',
    padding: '0 12%',
    pointerEvents: 'none',
    borderRadius: '1rem',
    overflow: 'hidden',
    fontFamily: BRAND.fonts.heading,
  };

  return (
    <AbsoluteFill style={container}>
      {/* Decorative background elements */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: BRAND.radialGlow,
          opacity: 0.6,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-18%',
          right: '-12%',
          width: '35%',
          height: '55%',
          background: BRAND.overlays.accentGradient,
          clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
          opacity: 0.65,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-25%',
          left: '-15%',
          width: '38%',
          height: '58%',
          background: BRAND.overlays.triangle,
          clipPath: 'polygon(0 100%, 0 0, 100% 100%)',
          opacity: 0.7,
        }}
      />
      {/* Optional badge */}
      {highlight.badge ? (
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            textTransform: 'uppercase',
            opacity: 0.75 * exitEased,
            fontFamily: BRAND.fonts.body,
          }}
        >
          {highlight.badge}
        </div>
      ) : null}
      {/* Main title */}
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: 2.1,
          textTransform: 'uppercase',
          color: theme?.textColor ?? BRAND.white,
          textShadow: '0 16px 40px rgba(12,12,12,0.38)',
        }}
      >
        {title}
      </div>
      {/* Optional subtitle */}
      <div
        style={{
          width: 180,
          height: 6,
          background: accent,
          opacity: exitEased,
          transform: `scaleX(${Math.max(0.2, eased)})`,
          transformOrigin: 'center',
          borderRadius: 999,
          boxShadow: `0 0 28px ${accentSoft}`,
        }}
      />
      {highlight.subtitle ? (
        <div
          style={{
            fontSize: 40,
            opacity: 0.86,
            maxWidth: '72%',
            lineHeight: 1.38,
            fontFamily: BRAND.fonts.body,
          }}
        >
          {highlight.subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * A map of highlight types to their corresponding renderer functions.
 */
const RENDERERS: Record<HighlightType, HighlightRenderer> = {
  typewriter: renderTypewriter,
  noteBox: renderNoteBox,
  sectionTitle: renderSectionTitle,
  icon: () => null, // Icon highlights are handled by IconEffect component
};

/**
 * Renders a highlight based on its type.
 * @param context The highlight render context.
 * @returns A ReactNode representing the rendered highlight.
 */
export const renderHighlightByType = (context: HighlightRenderContext): ReactNode => {
  const highlightType = (context.highlight.type as HighlightType | undefined) ?? 'noteBox';
  const renderer = RENDERERS[highlightType] ?? renderNoteBox; // Fallback to noteBox
  return renderer(context);
};




