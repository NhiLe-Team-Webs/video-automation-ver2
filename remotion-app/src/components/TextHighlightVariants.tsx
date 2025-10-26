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
  frame: number;
  fps: number;
  durationInFrames: number;
  appearWindowInFrames: number;
}

type HighlightRenderer = (context: HighlightRenderContext) => ReactNode;

type CornerLayout = 'none' | 'left' | 'right' | 'dual';

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const clampTo = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const DEFAULT_SAFE_HORIZONTAL = 0.08;
const DEFAULT_SAFE_BOTTOM = 0.08;
const DEFAULT_SAFE_TOP = 0.18;
const DEFAULT_STAGGER_LEFT_SECONDS = 0;
const DEFAULT_STAGGER_RIGHT_SECONDS = 2;

const toPercent = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${(clampTo(value, 0.02, 0.2) * 100).toFixed(2)}%`;
  }
  if (typeof value === 'string') {
    return value;
  }
  return `${(fallback * 100).toFixed(2)}%`;
};

const resolveDelaySeconds = (
  value: unknown,
  fallbackSeconds: number,
  appearWindowInSeconds: number
) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 1) {
      return clampTo(value, 0, 0.9) * appearWindowInSeconds;
    }
    return clampTo(value, 0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallbackSeconds;
    }

    if (trimmed.endsWith('s')) {
      const numericPortion = Number(trimmed.slice(0, -1));
      if (Number.isFinite(numericPortion)) {
        return clampTo(numericPortion, 0, 10);
      }
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      if (numeric <= 1) {
        return clampTo(numeric, 0, 0.9) * appearWindowInSeconds;
      }
      return clampTo(numeric, 0, 10);
    }
  }

  return fallbackSeconds;
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

const VERB_LIKE_WORDS = new Set(
  [
    'be',
    'am',
    'is',
    'are',
    'was',
    'were',
    'being',
    'been',
    'do',
    'does',
    'did',
    'doing',
    'have',
    'has',
    'had',
    'having',
    'make',
    'makes',
    'making',
    'watch',
    'watches',
    'watching',
    'interact',
    'interacts',
    'interacting',
    'discuss',
    'discusses',
    'discussing',
    'explain',
    'explains',
    'explaining',
    'stand',
    'stands',
    'standing',
    'tell',
    'tells',
    'telling',
    'catch',
    'catches',
    'catching',
    'let',
    'lets',
    'letting',
    'take',
    'takes',
    'taking',
    'know',
    'knows',
    'knowing',
    'think',
    'thinks',
    'thinking',
    'feel',
    'feels',
    'feeling',
    'see',
    'sees',
    'seeing',
    'talk',
    'talks',
    'talking',
    'say',
    'says',
    'saying',
    'look',
    'looks',
    'looking',
    'get',
    'gets',
    'getting',
    'give',
    'gives',
    'giving',
    'keep',
    'keeps',
    'keeping',
    'want',
    'wants',
    'wanting',
    'need',
    'needs',
    'needing',
    'allow',
    'allows',
    'allowing',
    'may',
    'might',
    'should',
    'could',
    'would',
    'will',
    'can',
    'today',
    'tonight',
    'now',
  ].map((token) => token.toLowerCase())
);

const normalizeForComparison = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenizeNormalized = (value: string | undefined): string[] => {
  const normalized = normalizeForComparison(value);
  return normalized ? normalized.split(' ') : [];
};

const preparePhrase = (value: string | undefined, wordLimit: number): string | undefined => {
  if (!value) {
    return undefined;
  }
  const tokens = value.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return undefined;
  }
  const filtered = tokens.filter((token) => !VERB_LIKE_WORDS.has(token.toLowerCase()));
  const selected = (filtered.length ? filtered : tokens).slice(0, Math.max(1, wordLimit));
  if (!selected.length) {
    return undefined;
  }
  return selected.join(' ');
};

const preparePrimaryPhrase = (value: string | undefined) => preparePhrase(value, 5);
const prepareSupportingPhrase = (value: string | undefined) => preparePhrase(value, 3);

const sanitizeCornerTexts = (
  primaryText: string | undefined,
  corners: {left?: string; right?: string}
) => {
  const primaryTokens = new Set(tokenizeNormalized(primaryText));

  const sanitize = (value: string | undefined) => {
    if (!value) {
      return undefined;
    }
    const prepared = prepareSupportingPhrase(value);
    const normalized = normalizeForComparison(prepared);
    if (!normalized) {
      return undefined;
    }
    const preparedTokens = prepared?.split(/\s+/).filter(Boolean) ?? [];
    const normalizedTokens = preparedTokens.map((token) =>
      normalizeForComparison(token).replace(/\s+/g, '')
    );
    if (!preparedTokens.length || !normalizedTokens.length) {
      return undefined;
    }
    const filteredTokens = preparedTokens.filter((token, index) => {
      const normalizedToken = normalizedTokens[index];
      if (!normalizedToken) {
        return false;
      }
      if (primaryTokens.has(normalizedToken)) {
        return false;
      }
      return true;
    });

    const finalTokens = filteredTokens.length ? filteredTokens : preparedTokens;
    const containsNewInformation = finalTokens.some((token) => {
      const normalizedToken = normalizeForComparison(token).replace(/\s+/g, '');
      return normalizedToken && !primaryTokens.has(normalizedToken);
    });

    if (!containsNewInformation) {
      return undefined;
    }
    return finalTokens.join(' ');
  };

  let left = sanitize(corners.left);
  let right = sanitize(corners.right);

  if (left && right && normalizeForComparison(left) === normalizeForComparison(right)) {
    right = undefined;
  }

  return {left, right};
};

const extractCornerTexts = (
  highlight: HighlightPlan,
  primaryText: string | undefined
): {left?: string; right?: string} => {
  const result: {left?: string; right?: string} = {};
  const asRecord = highlight as Record<string, unknown>;

  const rawContent = asRecord.content;
  if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    const record = rawContent as Record<string, unknown>;
    result.left = prepareSupportingPhrase(
      pickString(record, ['top_left', 'topLeft', 'left', 'primary'])
    );
    result.right = prepareSupportingPhrase(
      pickString(record, ['top_right', 'topRight', 'right', 'secondary'])
    );

    if (!result.left && Array.isArray(record.items)) {
      result.left = prepareSupportingPhrase(coerceText(record.items[0]));
      result.right = result.right ?? prepareSupportingPhrase(coerceText(record.items[1]));
    }
  }

  const supporting = highlight.supportingTexts as Record<string, unknown> | undefined;
  if (supporting) {
    result.left =
      result.left ??
      prepareSupportingPhrase(
        pickString(supporting, ['topLeft', 'top_left', 'left', 'primary', 'top_center', 'topCenter'])
      );
    result.right =
      result.right ??
      prepareSupportingPhrase(
        pickString(supporting, ['topRight', 'top_right', 'right', 'secondary', 'top_center', 'topCenter'])
      );
  }

  result.left =
    result.left ??
    prepareSupportingPhrase(
      pickString(asRecord, ['supportingLeft', 'supportLeft', 'supporting', 'keyword'])
    );
  result.right =
    result.right ??
    prepareSupportingPhrase(pickString(asRecord, ['supportingRight', 'supportRight', 'secondary']));

  const metadata = asRecord.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const metadataRecord = metadata as Record<string, unknown>;
    result.left =
      result.left ?? prepareSupportingPhrase(pickString(metadataRecord, ['top_left', 'topLeft', 'left']));
    result.right =
      result.right ?? prepareSupportingPhrase(pickString(metadataRecord, ['top_right', 'topRight', 'right']));
  }

  return sanitizeCornerTexts(primaryText, result);
};

const resolvePrimaryText = (highlight: HighlightPlan): string | undefined =>
  preparePrimaryPhrase(coerceText(highlight.keyword)) ??
  preparePrimaryPhrase(coerceText(highlight.text)) ??
  preparePrimaryPhrase(coerceText(highlight.title)) ??
  preparePrimaryPhrase(coerceText(highlight.subtitle));

interface HighlightPlacements {
  corners: CornerLayout;
  showBottom: boolean;
}

const determinePlacements = (
  highlight: HighlightPlan,
  corners: {left?: string; right?: string},
  primaryText: string | undefined
): HighlightPlacements => {
  const asRecord = highlight as Record<string, unknown>;
  const rawLayout = coerceText(asRecord.layout)?.toLowerCase() as
    | 'auto'
    | 'left'
    | 'right'
    | 'dual'
    | 'bottom'
    | 'none'
    | undefined;

  const hidePrimary = asRecord.hidePrimary === true;
  const hasPrimary = Boolean(primaryText) && !hidePrimary;
  const explicitShowBottom =
    typeof asRecord.showBottom === 'boolean'
      ? (asRecord.showBottom as boolean)
      : typeof asRecord.showPrimary === 'boolean'
        ? (asRecord.showPrimary as boolean)
        : undefined;

  if (rawLayout && rawLayout !== 'auto') {
    if (rawLayout === 'bottom') {
      const showBottom =
        hasPrimary && (explicitShowBottom !== undefined ? explicitShowBottom : true);
      return {corners: 'none', showBottom};
    }
    if (rawLayout === 'none') {
      const showBottom =
        hasPrimary && (explicitShowBottom !== undefined ? explicitShowBottom : false);
      return {corners: 'none', showBottom};
    }
    if (rawLayout === 'left' || rawLayout === 'right' || rawLayout === 'dual') {
      const showBottom =
        hasPrimary && (explicitShowBottom !== undefined ? explicitShowBottom : true);
      return {corners: rawLayout, showBottom};
    }
  }

  const hasLeft = Boolean(corners.left);
  const hasRight = Boolean(corners.right);

  let cornerLayout: CornerLayout = 'none';
  if (hasLeft && hasRight) {
    cornerLayout = 'dual';
  } else if (hasLeft) {
    cornerLayout = 'left';
  } else if (hasRight) {
    cornerLayout = 'right';
  }

  let showBottom = hasPrimary;
  if (hasPrimary) {
    showBottom = explicitShowBottom !== undefined ? explicitShowBottom : true;
  }

  return {corners: cornerLayout, showBottom};
};

const renderCornerLayout = (
  {highlight, exit, theme, frame, fps, appearWindowInFrames, height}: HighlightRenderContext,
  layout: CornerLayout,
  corners: {left?: string; right?: string}
) => {
  const inferredAppearWindow =
    Number.isFinite(appearWindowInFrames) && appearWindowInFrames > 0
      ? Math.round(appearWindowInFrames)
      : Math.round(Math.max(1, fps) * 0.3);
  const appearWindow = Math.max(1, inferredAppearWindow);
  const appearWindowSeconds = appearWindow / Math.max(1, fps);
  const exitEased = clamp01(exit);
  const exitProgress = 1 - exitEased;
  const asRecord = highlight as Record<string, unknown>;

  const staggerRecord =
    (typeof asRecord.stagger === 'object' && asRecord.stagger !== null
      ? (asRecord.stagger as Record<string, unknown>)
      : undefined) ?? {};

  const rightDefaultDelay =
    layout === 'dual' && corners.left && corners.right ? DEFAULT_STAGGER_RIGHT_SECONDS : 0;

  const leftDelaySeconds = resolveDelaySeconds(
    asRecord.staggerLeft ?? staggerRecord.left,
    DEFAULT_STAGGER_LEFT_SECONDS,
    appearWindowSeconds
  );
  const rightDelaySeconds = resolveDelaySeconds(
    asRecord.staggerRight ?? staggerRecord.right,
    rightDefaultDelay,
    appearWindowSeconds
  );

  const normalizedFrame = Math.max(0, frame);

  const progressForDelay = (delaySeconds: number) => {
    const delayFrames = Math.round(delaySeconds * fps);
    const localProgress = (normalizedFrame - Math.max(0, delayFrames)) / appearWindow;
    return ease(clamp01(localProgress));
  };

  const leftProgress = progressForDelay(leftDelaySeconds);
  const effectiveRightDelaySeconds =
    layout === 'dual' && corners.right
      ? Math.max(rightDelaySeconds, leftDelaySeconds + DEFAULT_STAGGER_RIGHT_SECONDS)
      : rightDelaySeconds;
  const rightProgress = progressForDelay(effectiveRightDelaySeconds);

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
  const maxWidthValue =
    typeof asRecord.maxWidth === 'string'
      ? asRecord.maxWidth
      : typeof asRecord.maxWidth === 'number'
        ? `${clampTo(asRecord.maxWidth, 0.22, 0.5) * 100}%`
        : 'clamp(18%, 28vw, 34%)';

  const topInset = toPercent(
    asRecord.safeTop ?? asRecord.safeInsetVertical ?? asRecord.safeMarginVertical,
    DEFAULT_SAFE_TOP
  );
  const verticalOffsetPx = 0;

  const buildSpanStyle = (side: 'left' | 'right', progress: number): CSSProperties => {
    const direction = side === 'left' ? -1 : 1;
    const appearShift = (1 - progress) * 32 * direction;
    const exitShift = exitProgress * 22 * direction;
    const verticalShift = (1 - progress) * 18 + exitProgress * 20;
    const scale = clampTo(1 + (1 - progress) * 0.02 - exitProgress * 0.04, 0.94, 1.08);
    const transforms = [
      `translate(${(appearShift + exitShift).toFixed(2)}px, ${(verticalShift + verticalOffsetPx).toFixed(2)}px)`,
      `scale(${scale})`,
    ];
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
      transform: transforms.join(' '),
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
  const scale = clampTo(1 + exitProgress * 0.04, 0.94, 1.08);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: exitEased}}>
      <div
        style={{
          position: 'absolute',
          left: horizontalInset,
          right: horizontalInset,
          bottom: bottomInset,
          display: 'flex',
          justifyContent: 'center',
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
            transform: `translateY(${(1 - eased) * 60 + exitProgress * 40}px) scale(${scale})`,
            opacity: Math.min(1, eased) * exitEased,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const renderTextHighlight: HighlightRenderer = (context) => {
  const {highlight} = context;
  const primaryText = resolvePrimaryText(highlight);
  const corners = extractCornerTexts(highlight, primaryText);
  const placements = determinePlacements(highlight, corners, primaryText);
  const elements: ReactNode[] = [];

  if (placements.showBottom && primaryText) {
    elements.push(renderBottomBanner(context, primaryText));
  }

  if (placements.corners !== 'none') {
    elements.push(renderCornerLayout(context, placements.corners, corners));
  }

  if (!elements.length) {
    return null;
  }

  return <>{elements}</>;
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
  const asRecord = highlight as Record<string, unknown>;
  const horizontalInset = toPercent(
    asRecord.safeInset ?? asRecord.safeInsetHorizontal ?? asRecord.safeMargin,
    DEFAULT_SAFE_HORIZONTAL
  );

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
    paddingLeft: horizontalInset,
    paddingRight: horizontalInset,
    pointerEvents: 'none',
    borderRadius: '1rem',
    overflow: 'hidden',
    fontFamily: BRAND.fonts.heading,
    gap: '1rem',
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
            marginBottom: '0.4rem',
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
          lineHeight: 0.94,
          maxWidth: '80%',
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
