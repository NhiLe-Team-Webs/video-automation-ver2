import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {BRAND} from '../config';
import type {HighlightPlan, HighlightTheme, HighlightType, HighlightPosition} from '../types';

/**
 * Defines CSS properties for different highlight positions.
 */
const POSITION_STYLES: Record<HighlightPosition, CSSProperties> = {
  top: {justifyContent: 'flex-start', alignItems: 'center', paddingTop: 140},
  center: {justifyContent: 'center', alignItems: 'center'},
  bottom: {justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 140},
};

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

/**
 * Applies common positioning and styling to a highlight's children.
 * @param highlight The highlight plan.
 * @param theme The highlight theme.
 * @param children The React nodes to position.
 * @returns A div element with applied styles and children.
 */
const applyPositioning = (
  highlight: HighlightPlan,
  theme: HighlightTheme | undefined,
  children: ReactNode
) => {
  const baseStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    padding: '0 6%',
    color: theme?.textColor ?? BRAND.white,
    fontFamily: theme?.fontFamily ?? BRAND.fonts.body,
    fontWeight: 500,
    letterSpacing: 0.2,
    textRendering: 'optimizeLegibility',
    pointerEvents: 'none',
    ...POSITION_STYLES[highlight.position ?? 'center'],
  };

  return <div style={baseStyle}>{children}</div>;
};

/**
 * Renders a 'typewriter' style highlight.
 * Text appears character by character with a blinking caret.
 * @param context The highlight render context.
 * @returns A ReactNode representing the typewriter highlight.
 */
const renderTypewriter: HighlightRenderer = ({highlight, appear, exit, theme}) => {
  const text = highlight.text ?? '';
  if (!text) {
    return null;
  }

  const eased = ease(clamp01(appear)); // Eased progress for appearance
  const exitEased = clamp01(exit); // Eased progress for exit
  const totalChars = text.length;
  const visibleChars = Math.max(0, Math.round(totalChars * eased));
  const content = text.slice(0, visibleChars);
  // Blinking caret opacity
  const caretOpacity = 0.35 + 0.65 * Math.abs(Math.sin(eased * Math.PI * 2.8));

  const textWrapper: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'baseline',
    fontSize: 60,
    fontFamily: theme?.fontFamily ?? BRAND.fonts.heading,
    fontWeight: 600,
    lineHeight: 1.28,
    letterSpacing: 0.6,
    color: theme?.textColor ?? BRAND.white,
    textShadow: '0 16px 40px rgba(12,12,12,0.45)',
    opacity: exitEased, // Fade out with exit animation
    transform: `translateY(${(1 - eased) * 26}px)` as string, // Slight vertical slide in
  };

  const caret: CSSProperties = {
    display: 'inline-block',
    width: '0.6ch',
    height: '1.05em',
    marginLeft: '0.3ch',
    background: theme?.accentColor ?? BRAND.primary,
    opacity: caretOpacity * exitEased,
    verticalAlign: 'baseline',
  };

  return applyPositioning(
    highlight,
    theme,
    <div style={textWrapper}>
      <span style={{whiteSpace: 'pre-wrap'}}>{content}</span>
      <span style={caret} />
    </div>
  );
};

/**
 * Renders a 'noteBox' style highlight.
 * A box with text that slides in from a specified side.
 * @param context The highlight render context.
 * @returns A ReactNode representing the note box highlight.
 */
const renderNoteBox: HighlightRenderer = ({highlight, appear, exit, theme}) => {
  const text = highlight.text ?? '';
  if (!text) {
    return null;
  }

  const eased = ease(clamp01(appear));
  const exitEased = clamp01(exit);

  const direction = highlight.side ?? 'bottom';
  const distance = 120;
  const translateValue = (1 - eased) * distance;
  const translate =
    direction === 'bottom'
      ? `translateY(${translateValue}px)`
      : `translateX(${direction === 'left' ? -translateValue : translateValue}px)`;

  const typedChars = Math.max(0, Math.round(text.length * clamp01(appear)));
  const content = text.slice(0, typedChars);

  // Resolve dynamic font sizing and width from highlight plan or defaults
  const maxWidth: string | number =
    typeof highlight.maxWidth === 'string' || typeof highlight.maxWidth === 'number'
      ? (highlight.maxWidth as string | number)
      : '70%';
  const fontSize: string | number =
    typeof highlight.fontSize === 'string' || typeof highlight.fontSize === 'number'
      ? (highlight.fontSize as string | number)
      : 52;
  const fontWeight: string | number =
    typeof highlight.fontWeight === 'string' || typeof highlight.fontWeight === 'number'
      ? (highlight.fontWeight as string | number)
      : 700;

  const textStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'baseline',
    maxWidth,
    fontSize,
    fontFamily: theme?.fontFamily ?? BRAND.fonts.heading,
    fontWeight,
    lineHeight: 1.24,
    letterSpacing: 0.5,
    whiteSpace: 'pre-wrap',
    color: theme?.textColor ?? BRAND.white,
    textShadow: '0 12px 32px rgba(12,12,12,0.45)',
    transform: translate, // Apply slide-in animation
    opacity: exitEased, // Fade out with exit animation
  };

  const caret: CSSProperties = {
    display: 'inline-block',
    width: '0.5ch',
    height: '1.05em',
    marginLeft: '0.3ch',
    background: theme?.accentColor ?? BRAND.primary,
    opacity: (0.45 + 0.45 * Math.abs(Math.sin(appear * Math.PI * 3.1))) * exitEased, // Blinking caret
    verticalAlign: 'baseline',
  };

  return applyPositioning(
    highlight,
    theme,
    <div style={textStyle}>
      <span style={{whiteSpace: 'pre-wrap'}}>{content}</span>
      <span style={caret} />
    </div>
  );
};

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
            fontSize: 32,
            letterSpacing: 6,
            textTransform: 'uppercase',
            marginBottom: 28,
            opacity: 0.8,
            fontFamily: BRAND.fonts.body,
          }}
        >
          {highlight.badge}
        </div>
      ) : null}
      {/* Main title */}
      <div
        style={{
          fontSize: 100,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: 2.2,
          textTransform: 'uppercase',
          textShadow: '0 22px 60px rgba(12,12,12,0.45)',
          WebkitTextStroke: '1px rgba(255,255,255,0.22)',
          padding: '0 4%',
        }}
      >
        {title}
      </div>
      {/* Optional subtitle */}
      {highlight.subtitle ? (
        <div
          style={{
            marginTop: 28,
            fontSize: 40,
            opacity: 0.86,
            maxWidth: '70%',
            lineHeight: 1.4,
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
