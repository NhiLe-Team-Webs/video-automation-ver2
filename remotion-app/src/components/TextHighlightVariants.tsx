import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {BRAND} from '../config';
import type {HighlightPlan, HighlightTheme, HighlightType} from '../types';

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

type CornerLayout = 'none' | 'left' | 'right' | 'dual' | 'bottom';

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const clampTo = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const DEFAULT_SAFE_HORIZONTAL = 0.08;
const DEFAULT_SAFE_VERTICAL = 0.1;
const DEFAULT_SAFE_BOTTOM = 0.12;
const DEFAULT_STAGGER_LEFT = 0;
const DEFAULT_STAGGER_RIGHT = 0.22;

const toPercent = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${(clampTo(value, 0.02, 0.2) * 100).toFixed(2)}%`;
  }
  if (typeof value === 'string') {
    return value;
  }
  return `${(fallback * 100).toFixed(2)}%`;
};

const normalizeDelay = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1) {
      // Treat values > 1 as seconds relative to a 1s window
      return clampTo(value / 5, 0, 0.9);
    }
    return clampTo(value, 0, 0.9);
  }
  return fallback;
};

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

const pickString = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    if (key in record) {
      const candidate = coerceText(record[key]);
      if (candidate) {
        return candidate;
      }
    }
  }
  return undefined;
};

const extractCornerTexts = (highlight: HighlightPlan) => {
  const result: {left?: string; right?: string} = {};
  const asRecord = highlight as Record<string, unknown>;

  const rawContent = asRecord.content;
  if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    const record = rawContent as Record<string, unknown>;
    result.left = pickString(record, ['top_left', 'topLeft', 'left', 'primary']);
    result.right = pickString(record, ['top_right', 'topRight', 'right', 'secondary']);

    if (!result.left && Array.isArray(record.items)) {
      result.left = coerceText(record.items[0]);
      result.right = result.right ?? coerceText(record.items[1]);
    }
  }

  const supporting = highlight.supportingTexts as Record<string, unknown> | undefined;
  if (supporting) {
    result.left =
      result.left ??
      pickString(supporting, ['topLeft', 'top_left', 'left', 'primary', 'top_center', 'topCenter']);
    result.right =
      result.right ??
      pickString(supporting, ['topRight', 'top_right', 'right', 'secondary', 'top_center', 'topCenter']);
  }

  result.left =
    result.left ?? pickString(asRecord, ['supportingLeft', 'supportLeft', 'supporting', 'keyword']);
  result.right =
    result.right ?? pickString(asRecord, ['supportingRight', 'supportRight', 'secondary']);

  const metadata = asRecord.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const metadataRecord = metadata as Record<string, unknown>;
    result.left = result.left ?? pickString(metadataRecord, ['top_left', 'topLeft', 'left']);
    result.right = result.right ?? pickString(metadataRecord, ['top_right', 'topRight', 'right']);
  }

  return result;
};

const resolvePrimaryText = (highlight: HighlightPlan): string | undefined =>
  coerceText(highlight.keyword) ??
  coerceText(highlight.text) ??
  coerceText(highlight.title) ??
  coerceText(highlight.subtitle);

const determineLayout = (
  highlight: HighlightPlan,
  corners: {left?: string; right?: string},
  primaryText: string | undefined
): CornerLayout => {
  const explicit = coerceText((highlight as Record<string, unknown>).layout) as CornerLayout | undefined;
  if (explicit && explicit !== 'auto') {
    return explicit;
  }

  const importance = coerceText((highlight as Record<string, unknown>).importance);
  if (importance === 'primary' || (highlight.position ?? '').toLowerCase() === 'bottom') {
    return primaryText ? 'bottom' : corners.left || corners.right ? 'dual' : 'none';
  }

  if (primaryText && (highlight.position ?? '').toLowerCase() === 'bottom') {
    return 'bottom';
  }

  if (corners.left && corners.right) {
    return 'dual';
  }

  if (corners.left) {
    return 'left';
  }

  if (corners.right) {
    return 'right';
  }

  return primaryText ? 'bottom' : 'none';
};

const renderCornerLayout = (
  {highlight, appear, exit, theme}: HighlightRenderContext,
  layout: CornerLayout,
  corners: {left?: string; right?: string}
) => {
  const baseAppear = clamp01(appear);
  const eased = ease(baseAppear);
  const exitEased = clamp01(exit);
  const exitProgress = 1 - exitEased;
  const asRecord = highlight as Record<string, unknown>;

  const staggerRecord =
    (typeof asRecord.stagger === 'object' && asRecord.stagger !== null
      ? (asRecord.stagger as Record<string, unknown>)
      : undefined) ?? {};

  const leftDelay = normalizeDelay(
    asRecord.staggerLeft ?? staggerRecord.left,
    DEFAULT_STAGGER_LEFT
  );
  const rightDelay = normalizeDelay(
    asRecord.staggerRight ?? staggerRecord.right,
    DEFAULT_STAGGER_RIGHT
  );

  const progressForSide = (side: 'left' | 'right') => {
    const delay = side === 'left' ? leftDelay : rightDelay;
    if (delay <= 0) {
      return ease(baseAppear);
    }
    const denominator = 1 - delay;
    if (denominator <= 0) {
      return ease(1);
    }
    const adjusted = (baseAppear - delay) / denominator;
    return ease(clamp01(adjusted));
  };

  const leftProgress = progressForSide('left');
  const rightProgress = progressForSide('right');

  const fontSize =
    typeof highlight.fontSize === 'number' || typeof highlight.fontSize === 'string'
      ? highlight.fontSize
      : 60;
  const fontWeight =
    typeof highlight.fontWeight === 'number' || typeof highlight.fontWeight === 'string'
      ? highlight.fontWeight
      : 900;
  const letterSpacing =
    typeof (highlight as Record<string, unknown>).letterSpacing === 'number'
      ? ((highlight as Record<string, unknown>).letterSpacing as number)
      : 1.1;
  const textTransform =
    typeof (highlight as Record<string, unknown>).textTransform === 'string'
      ? ((highlight as Record<string, unknown>).textTransform as CSSProperties['textTransform'])
      : 'uppercase';

  const horizontalInset = toPercent(
    asRecord.safeInset ?? asRecord.safeInsetHorizontal ?? asRecord.safeMargin,
    DEFAULT_SAFE_HORIZONTAL
  );
  const topInset = toPercent(asRecord.safeTop ?? asRecord.safeInsetVertical, DEFAULT_SAFE_VERTICAL);
  const maxWidthValue =
    typeof asRecord.maxWidth === 'string'
      ? asRecord.maxWidth
      : typeof asRecord.maxWidth === 'number'
        ? `${clampTo(asRecord.maxWidth, 0.22, 0.5) * 100}%`
        : 'clamp(18%, 28vw, 34%)';

  const buildSpanStyle = (side: 'left' | 'right', progress: number): CSSProperties => {
    const direction = side === 'left' ? -1 : 1;
    const appearShift = (1 - progress) * 32 * direction;
    const exitShift = exitProgress * 22 * direction;
    const verticalShift = (1 - progress) * 18 + exitProgress * 20;
    const scale = clampTo(1 + (1 - progress) * 0.02 - exitProgress * 0.04, 0.94, 1.08);
    return {
      position: 'absolute',
      top: topInset,
      [side]: horizontalInset,
      maxWidth: maxWidthValue,
      textAlign: side === 'left' ? 'left' : 'right',
      fontFamily: theme?.fontFamily ?? BRAND.fonts.heading,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight: 1.04,
      textTransform,
      color: theme?.textColor ?? BRAND.white,
      whiteSpace: 'pre-wrap',
      textRendering: 'geometricPrecision',
      opacity: Math.min(1, progress) * exitEased,
      transform: `translate(${appearShift + exitShift}px, ${verticalShift}px) scale(${scale})`,
    };
  };

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {(layout === 'left' || layout === 'dual') && corners.left ? (
        <span style={buildSpanStyle('left', leftProgress)}>{corners.left}</span>
      ) : null}
      {(layout === 'right' || layout === 'dual') && corners.right ? (
        <span style={buildSpanStyle('right', rightProgress)}>{corners.right}</span>
      ) : null}
    </AbsoluteFill>
  );
};

const renderBottomBanner = (
  {highlight, appear, exit, theme}: HighlightRenderContext,
  text: string
) => {
  const eased = ease(clamp01(appear));
  const exitEased = clamp01(exit);
  const exitProgress = 1 - exitEased;
  const asRecord = highlight as Record<string, unknown>;
  const fontSize =
    typeof highlight.fontSize === 'number' || typeof highlight.fontSize === 'string'
      ? highlight.fontSize
      : 120;
  const fontWeight =
    typeof highlight.fontWeight === 'number' || typeof highlight.fontWeight === 'string'
      ? highlight.fontWeight
      : 900;
  const letterSpacing =
    typeof (highlight as Record<string, unknown>).letterSpacing === 'number'
      ? ((highlight as Record<string, unknown>).letterSpacing as number)
      : 1.4;
  const textTransform =
    typeof (highlight as Record<string, unknown>).textTransform === 'string'
      ? ((highlight as Record<string, unknown>).textTransform as CSSProperties['textTransform'])
      : 'uppercase';

  const horizontalInset = toPercent(
    asRecord.safeInset ?? asRecord.safeInsetHorizontal ?? asRecord.safeMargin,
    DEFAULT_SAFE_HORIZONTAL
  );
  const bottomInset = toPercent(
    asRecord.safeBottom ?? asRecord.safeInsetVertical,
    DEFAULT_SAFE_BOTTOM
  );

  const color = theme?.textColor ?? BRAND.white;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: bottomInset,
        paddingLeft: horizontalInset,
        paddingRight: horizontalInset,
        opacity: exitEased,
      }}
    >
      <div
        style={{
          fontFamily: theme?.fontFamily ?? BRAND.fonts.heading,
          fontSize,
          fontWeight,
          letterSpacing,
          textTransform,
          color,
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          textRendering: 'geometricPrecision',
          transform: `translateY(${(1 - eased) * 60 + exitProgress * 40}px) scale(${clampTo(
            1 + exitProgress * 0.04,
            0.94,
            1.08
          )})`,
          opacity: Math.min(1, eased) * exitEased,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const renderTextHighlight: HighlightRenderer = (context) => {
  const {highlight} = context;
  const corners = extractCornerTexts(highlight);
  const primaryText = resolvePrimaryText(highlight);
  const layout = determineLayout(highlight, corners, primaryText);

  if (layout === 'none') {
    return null;
  }

  if (layout === 'bottom' && primaryText) {
    return renderBottomBanner(context, primaryText);
  }

  return renderCornerLayout(context, layout, corners);
};

const renderSectionTitle: HighlightRenderer = ({highlight, appear, exit, theme}) => {
  const title = highlight.title ?? highlight.text ?? '';
  if (!title) {
    return null;
  }

  const backgroundVariant = (highlight.variant ?? '').toLowerCase();
  const baseGradient =
    backgroundVariant === 'black'
      ? `linear-gradient(140deg, rgba(28,28,28,0.95) 0%, rgba(12,12,12,0.98) 100%)`
      : BRAND.gradient;

  const eased = ease(clamp01(appear));
  const exitEased = clamp01(exit);
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
    </AbsoluteFill>
  );
};

const renderTypewriter: HighlightRenderer = renderTextHighlight;
const renderNoteBox: HighlightRenderer = renderTextHighlight;

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
