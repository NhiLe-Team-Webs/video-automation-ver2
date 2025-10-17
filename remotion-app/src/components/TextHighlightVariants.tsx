import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {BRAND} from '../config';
import type {HighlightPlan, HighlightTheme, HighlightType, HighlightPosition} from '../types';

const POSITION_STYLES: Record<HighlightPosition, CSSProperties> = {
  top: {justifyContent: 'flex-start', alignItems: 'center', paddingTop: 140},
  center: {justifyContent: 'center', alignItems: 'center'},
  bottom: {justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 140},
};

const ease = Easing.bezier(0.42, 0, 0.58, 1);

interface HighlightRenderContext {
  highlight: HighlightPlan;
  appear: number;
  exit: number;
  theme?: HighlightTheme;
  width: number;
  height: number;
}

type HighlightRenderer = (context: HighlightRenderContext) => ReactNode;

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

const renderTypewriter: HighlightRenderer = ({highlight, appear, exit, theme}) => {
  const text = highlight.text ?? '';
  if (!text) {
    return null;
  }

  const eased = ease(clamp01(appear));
  const exitEased = clamp01(exit);
  const totalChars = text.length;
  const visibleChars = Math.max(0, Math.round(totalChars * eased));
  const content = text.slice(0, visibleChars);
  const caretOpacity = 0.35 + 0.65 * Math.abs(Math.sin(eased * Math.PI * 2.8));
  const accent = highlight.accentColor ?? theme?.accentColor ?? BRAND.primary;
  const fontSize =
    typeof highlight.fontSize === 'string' || typeof highlight.fontSize === 'number'
      ? (highlight.fontSize as string | number)
      : 60;
  const fontWeight =
    typeof highlight.fontWeight === 'string' || typeof highlight.fontWeight === 'number'
      ? (highlight.fontWeight as string | number)
      : 600;

  const textWrapper: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'baseline',
    fontSize,
    fontFamily: theme?.fontFamily ?? BRAND.fonts.heading,
    fontWeight,
    lineHeight: 1.28,
    letterSpacing: 0.6,
    color: theme?.textColor ?? BRAND.white,
    textShadow: '0 8px 28px rgba(12,12,12,0.4)',
    opacity: exitEased,
    transform: `translateY(${(1 - eased) * 20}px)` as string,
  };

  const caret: CSSProperties = {
    display: 'inline-block',
    width: '0.6ch',
    height: '1.05em',
    marginLeft: '0.3ch',
    background: accent,
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


const renderNoteBox: HighlightRenderer = ({highlight, appear, exit, theme}) => {
  const text = highlight.text ?? '';
  if (!text) {
    return null;
  }

  const eased = ease(clamp01(appear));
  const exitEased = clamp01(exit);
  const accent = highlight.accentColor ?? theme?.accentColor ?? BRAND.primary;
  const accentSoft = withAlpha(accent, 0.26, 'rgba(255,255,255,0.18)');
  const maxWidth: string | number =
    typeof highlight.maxWidth === 'string' || typeof highlight.maxWidth === 'number'
      ? (highlight.maxWidth as string | number)
      : '68%';
  const fontSize: string | number =
    typeof highlight.fontSize === 'string' || typeof highlight.fontSize === 'number'
      ? (highlight.fontSize as string | number)
      : 54;
  const fontWeight: string | number =
    typeof highlight.fontWeight === 'string' || typeof highlight.fontWeight === 'number'
      ? (highlight.fontWeight as string | number)
      : 700;

  const scale = 0.88 + eased * 0.12;
  const translateY = (1 - eased) * 32;

  const textStyle: CSSProperties = {
    maxWidth,
    fontSize,
    fontFamily: theme?.fontFamily ?? BRAND.fonts.heading,
    fontWeight,
    lineHeight: 1.24,
    letterSpacing: 0.5,
    whiteSpace: 'pre-wrap',
    color: theme?.textColor ?? BRAND.white,
    textShadow: '0 10px 28px rgba(12,12,12,0.38)',
    transform: `translateY(${translateY}px) scale(${scale})`,
    transformOrigin: 'left center',
    opacity: exitEased,
  };

  const highlightedText: CSSProperties = {
    backgroundImage: `linear-gradient(120deg, ${accentSoft} 0%, transparent 100%)`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${Math.min(100, Math.max(12, eased * 100))}% 0.55em`,
    backgroundPosition: '0 100%',
    paddingBottom: '0.18em',
    whiteSpace: 'pre-wrap',
  };

  return applyPositioning(
    highlight,
    theme,
    <div style={textStyle}>
      <span style={highlightedText}>{text}</span>
    </div>
  );
};


const renderSectionTitle: HighlightRenderer = ({highlight, appear, exit, theme}) => {
  const title = highlight.title ?? highlight.text ?? '';
  if (!title) {
    return null;
  }

  const eased = ease(clamp01(appear));
  const exitEased = clamp01(exit);
  const accent = highlight.accentColor ?? theme?.accentColor ?? BRAND.primary;
  const accentSoft = withAlpha(accent, 0.24, 'rgba(255,255,255,0.24)');
  const baseScale = 0.88 + eased * 0.12;
  const translateY = (1 - eased) * 40;

  const container = applyPositioning(
    highlight,
    theme,
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        textAlign: 'center',
        transform: `translateY(${translateY}px) scale(${baseScale})`,
        transformOrigin: 'center',
        opacity: exitEased,
        fontFamily: theme?.fontFamily ?? BRAND.fonts.heading,
      }}
    >
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
    </div>
  );

  return <AbsoluteFill>{container}</AbsoluteFill>;
};

const RENDERERS: Record<HighlightType, HighlightRenderer> = {
  typewriter: renderTypewriter,
  noteBox: renderNoteBox,
  sectionTitle: renderSectionTitle,
  icon: () => null,
};

export const renderHighlightByType = (context: HighlightRenderContext): ReactNode => {
  const highlightType = (context.highlight.type as HighlightType | undefined) ?? 'noteBox';
  const renderer = RENDERERS[highlightType] ?? renderNoteBox;
  return renderer(context);
};
