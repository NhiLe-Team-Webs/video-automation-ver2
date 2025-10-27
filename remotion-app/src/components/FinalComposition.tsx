import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {useMemo} from 'react';
import {usePlan} from '../hooks/usePlan';
import type {FinalCompositionProps, HighlightPlan, Plan} from '../types';
import {BRAND, resolveRuntimeConfig} from '../config';
import {HighlightsLayer} from './HighlightsLayer';
import {BrollLayer} from './BrollLayer';
import {SfxLayer} from './SfxLayer';
import {VideoTimeline, buildTimelineMetadata} from './VideoTimeline';
import type {TimelineSegment} from './timeline';

const DEFAULT_TRANSITION_SECONDS = 0.75;
const MAX_TEXT_HIGHLIGHT_DURATION_SECONDS = 4;
const SECTION_TITLE_DEFAULT_DURATION_SECONDS = 3.2;
const SECTION_TITLE_MIN_DURATION_SECONDS = 2;
const DEFAULT_SECTION_SFX = 'assets/sfx/whoosh/woosh.mp3';

const clampHighlightDuration = (highlight: HighlightPlan): HighlightPlan => {
  const type = highlight.type ?? 'noteBox';
  const maxDuration =
    type === 'sectionTitle' ? SECTION_TITLE_DEFAULT_DURATION_SECONDS : MAX_TEXT_HIGHLIGHT_DURATION_SECONDS;
  const safeDuration = Number.isFinite(highlight.duration) ? Math.max(0, highlight.duration) : 0;

  if (safeDuration <= 0) {
    return {
      ...highlight,
      duration: Math.min(maxDuration, 1.5),
    };
  }

  if (safeDuration <= maxDuration) {
    return highlight;
  }

  return {
    ...highlight,
    duration: maxDuration,
  };
};

const coerceString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const buildSectionHighlights = (
  plan: Plan | null,
  timeline: TimelineSegment[],
  fps: number
): HighlightPlan[] => {
  if (!plan || !plan.segments.length || !timeline.length) {
    return [];
  }

  type Anchor = {
    timelineSegment: TimelineSegment;
    title: string;
    subtitle?: string;
    badge?: string;
  };

  const anchors: Anchor[] = [];

  for (const timelineSegment of timeline) {
    const segment = timelineSegment.segment;
    const metadata = (segment.metadata ?? {}) as Record<string, unknown>;
    const explicitTitle =
      coerceString(metadata.sectionTitle) ??
      coerceString(metadata.section) ??
      coerceString(metadata.chapter) ??
      coerceString(metadata.heading);

    if (explicitTitle) {
      anchors.push({
        timelineSegment,
        title: explicitTitle,
        subtitle:
          coerceString(metadata.sectionSubtitle) ??
          coerceString(metadata.subheading) ??
          coerceString(metadata.summary),
        badge: coerceString(metadata.sectionBadge) ?? coerceString(metadata.sectionLabel),
      });
    }
  }

  if (!anchors.length) {
    const desiredFallbackCount = Math.min(4, Math.max(1, Math.round(timeline.length / 5)));
    const fallbackIndices = new Set<number>();
    fallbackIndices.add(0);
    if (timeline.length > 1) {
      for (let i = 1; i < desiredFallbackCount; i++) {
        const fraction = i / desiredFallbackCount;
        const index = Math.min(timeline.length - 1, Math.round(fraction * (timeline.length - 1)));
        fallbackIndices.add(index);
      }
    }
    const sortedIndices = Array.from(fallbackIndices).sort((a, b) => a - b);

    sortedIndices.forEach((index, order) => {
      const timelineSegment = timeline[index];
      const segment = timelineSegment.segment;
      const fallbackTitle = coerceString(segment.title) ?? coerceString(segment.label);
      if (!fallbackTitle) {
        return;
      }
      anchors.push({
        timelineSegment,
        title: fallbackTitle,
        badge: `Section ${order + 1}`,
      });
    });
  }

  if (!anchors.length) {
    return [];
  }

  const seenTitles = new Set<string>();
  const sectionHighlights: HighlightPlan[] = [];

  anchors.forEach((anchor, index) => {
    const normalizedTitle = anchor.title.toLowerCase();
    if (seenTitles.has(normalizedTitle)) {
      return;
    }
    seenTitles.add(normalizedTitle);

    const {timelineSegment} = anchor;
    const segmentDurationSeconds = Math.max(timelineSegment.duration / fps, 0.5);
    const idealDuration = Math.min(
      SECTION_TITLE_DEFAULT_DURATION_SECONDS,
      Math.max(SECTION_TITLE_MIN_DURATION_SECONDS, segmentDurationSeconds * 0.55)
    );
    const availableDuration = Math.max(segmentDurationSeconds - 0.25, 0.75);
    const targetDuration = Math.max(0.75, Math.min(idealDuration, availableDuration));
    const startSeconds = Math.max(0, timelineSegment.from / fps + 0.12);

    sectionHighlights.push({
      id: `section-${timelineSegment.segment.id}`,
      type: 'sectionTitle',
      start: startSeconds,
      duration: targetDuration,
      title: anchor.title,
      subtitle: anchor.subtitle,
      badge: anchor.badge ?? `Section ${index + 1}`,
      sfx: DEFAULT_SECTION_SFX,
      ducking: true,
      gain: -9,
    });
  });

  return sectionHighlights.sort((a, b) => a.start - b.start);
};

const LoadingState: React.FC<{message: string}> = ({message}) => {
  return (
    <AbsoluteFill
      style={{
        background: BRAND.gradient,
        alignItems: 'center',
        justifyContent: 'center',
        color: BRAND.white,
        fontFamily: BRAND.fonts.heading,
        fontSize: 56,
        letterSpacing: 1.8,
        textTransform: 'uppercase',
      }}
    >
      <div
        style={{
          padding: '2.4rem 3.6rem',
          borderRadius: '1rem',
          background: BRAND.overlays.glassBackground,
          border: `1px solid ${BRAND.overlays.glassBorder}`,
          backdropFilter: 'blur(22px)',
          boxShadow: '0 24px 80px rgba(12,12,12,0.4)',
          fontFamily: BRAND.fonts.body,
          fontSize: 32,
          letterSpacing: 0.5,
          textTransform: 'none',
        }}
      >
        {message}
      </div>
    </AbsoluteFill>
  );
};

const PlanAwareTimeline: React.FC<{
  plan: Plan;
  fallbackTransitionDuration: number;
  inputVideo: string;
  runtimeConfig: ReturnType<typeof resolveRuntimeConfig>;
  timeline: TimelineSegment[];
}> = ({plan, fallbackTransitionDuration, inputVideo, runtimeConfig, timeline}) => {
  const {fps} = useVideoConfig();
  return (
    <VideoTimeline
      plan={plan}
      fps={fps}
      fallbackTransitionDuration={fallbackTransitionDuration}
      inputVideo={inputVideo}
      runtimeConfig={runtimeConfig}
      timeline={timeline}
    />
  );
};

export const FinalComposition: React.FC<FinalCompositionProps> = ({
  plan,
  planPath = 'input/plan.json',
  inputVideo = 'input/input.mp4',
  fallbackTransitionDuration = DEFAULT_TRANSITION_SECONDS,
  highlightTheme,
  config,
}) => {
  const {fps} = useVideoConfig();
  const shouldLoadPlan = Boolean(planPath);
  const {plan: loadedPlan, status, error} = usePlan(planPath, {enabled: shouldLoadPlan});

  const activePlan = loadedPlan ?? plan ?? null;

  const runtimeConfig = useMemo(() => resolveRuntimeConfig(config), [config]);

  const timelineMetadata = useMemo(() => {
    if (!activePlan) {
      return {
        timeline: [] as TimelineSegment[],
        totalDurationInFrames: fps * 10,
      };
    }
    const computed = buildTimelineMetadata(activePlan.segments, fps, fallbackTransitionDuration);
    return {
      timeline: computed.timeline,
      totalDurationInFrames: Math.max(1, computed.totalDurationInFrames),
    };
  }, [activePlan, fallbackTransitionDuration, fps]);

  const sectionHighlights = useMemo(
    () => buildSectionHighlights(activePlan, timelineMetadata.timeline, fps),
    [activePlan, fps, timelineMetadata.timeline]
  );

  const sanitizedHighlights = useMemo(() => {
    if (!activePlan) {
      return [] as HighlightPlan[];
    }

    const baseHighlights = (activePlan.highlights ?? [])
      .filter(
        (highlight) =>
          typeof highlight.start === 'number' &&
          Number.isFinite(highlight.start) &&
          typeof highlight.duration === 'number' &&
          highlight.duration > 0
      )
      .map(clampHighlightDuration);

    const combined = [...baseHighlights, ...sectionHighlights];
    const seenIds = new Set<string>();
    const deduped: HighlightPlan[] = [];

    for (const highlight of combined) {
      const id = highlight.id;
      if (!id || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      deduped.push(highlight);
    }

    const sorted = deduped.sort((a, b) => a.start - b.start);
    const totalDurationSeconds =
      timelineMetadata.totalDurationInFrames > 0 ? timelineMetadata.totalDurationInFrames / fps : 0;
    const gapSeconds = 0.2;

    const clampWindow = (startSeconds: number, durationSeconds: number) => {
      const safeDuration = Math.max(0.4, Number.isFinite(durationSeconds) ? durationSeconds : 0);
      if (totalDurationSeconds <= 0) {
        return {start: Math.max(0, startSeconds), duration: safeDuration};
      }
      let start = Math.max(0, Number.isFinite(startSeconds) ? startSeconds : 0);
      let end = start + safeDuration;
      if (end > totalDurationSeconds) {
        const overshoot = end - totalDurationSeconds;
        start = Math.max(0, start - overshoot);
        end = totalDurationSeconds;
      }
      const clampedDuration = Math.max(0.3, end - start);
      return {start, duration: clampedDuration};
    };

    type Window = {start: number; end: number; type: 'section' | 'text'};
    const reserved: Window[] = [];
    const adjusted: HighlightPlan[] = [];

    const overlaps = (window: Window, start: number, end: number) =>
      start < window.end + gapSeconds && end > window.start - gapSeconds;

    for (const highlight of sorted) {
      const isSection = (highlight.type ?? '').toLowerCase() === 'sectiontitle';
      const {start: initialStart, duration: initialDuration} = clampWindow(
        highlight.start,
        highlight.duration
      );
      let start = initialStart;
      let duration = initialDuration;

      if (!isSection) {
        let attempt = 0;
        let conflict = reserved.find((window) => overlaps(window, start, start + duration));

        while (conflict && attempt < 6) {
          start = conflict.end + gapSeconds;
          const clamped = clampWindow(start, duration);
          start = clamped.start;
          duration = clamped.duration;
          conflict = reserved.find((window) => overlaps(window, start, start + duration));
          attempt += 1;
        }

        if (start >= totalDurationSeconds - 0.2) {
          continue;
        }
      }

      const finalWindow = clampWindow(start, duration);
      const finalStart = Number.isFinite(finalWindow.start) ? finalWindow.start : 0;
      const finalDuration =
        Number.isFinite(finalWindow.duration) && finalWindow.duration > 0.2
          ? finalWindow.duration
          : 0.6;
      const finalEnd = finalStart + finalDuration;

      if (totalDurationSeconds > 0 && finalStart >= totalDurationSeconds - 0.1) {
        continue;
      }

      reserved.push({
        start: finalStart,
        end: finalEnd,
        type: isSection ? 'section' : 'text',
      });

      adjusted.push({
        ...highlight,
        start: Number(finalStart.toFixed(2)),
        duration: Number(finalDuration.toFixed(2)),
      });
    }

    return adjusted;
  }, [activePlan, fps, sectionHighlights, timelineMetadata.totalDurationInFrames]);

  if (!activePlan) {
    if (status === 'error') {
      return <LoadingState message={error ?? 'Unable to load the editing plan.'} />;
    }

    return <LoadingState message="Loading editing plan..." />;
  }

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(120deg, #FFFFFF 0%, #F2F2F2 30%, #0F0F0F 100%)',
        fontFamily: BRAND.fonts.body,
        color: BRAND.white,
      }}
    >
      <AbsoluteFill
        style={{
          background: BRAND.radialGlow,
          opacity: 0.45,
          mixBlendMode: 'multiply',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 80% 15%, rgba(200,16,46,0.28), transparent 65%)',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill style={{padding: '72px 84px'}}>
        <AbsoluteFill
          style={{
            overflow: 'hidden',
            boxShadow: '0 32px 140px rgba(12,12,12,0.38)',
            backgroundColor: BRAND.charcoal,
            border: `1px solid ${BRAND.overlays.glassBorder}`,
          }}
        >
          <AbsoluteFill
            style={{
              background: BRAND.gradient,
              opacity: 0.78,
              mixBlendMode: 'soft-light',
              pointerEvents: 'none',
            }}
          />
          <AbsoluteFill
            style={{
              background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.08), transparent 70%)',
              opacity: 0.55,
              pointerEvents: 'none',
            }}
          />

          <Sequence name="video" durationInFrames={timelineMetadata.totalDurationInFrames}>
            <PlanAwareTimeline
              plan={activePlan}
              fallbackTransitionDuration={fallbackTransitionDuration}
              inputVideo={inputVideo}
              runtimeConfig={runtimeConfig}
              timeline={timelineMetadata.timeline}
            />
          </Sequence>

          <Sequence name="broll" durationInFrames={timelineMetadata.totalDurationInFrames}>
            <BrollLayer plan={activePlan} timeline={timelineMetadata.timeline} fps={fps} />
          </Sequence>

          <Sequence name="highlights" durationInFrames={timelineMetadata.totalDurationInFrames}>
            <HighlightsLayer highlights={sanitizedHighlights} fps={fps} theme={highlightTheme} />
          </Sequence>

          <Sequence name="sfx" durationInFrames={timelineMetadata.totalDurationInFrames}>
            <SfxLayer
              highlights={sanitizedHighlights}
              fps={fps}
              timeline={timelineMetadata.timeline}
              audioConfig={runtimeConfig.audio}
            />
          </Sequence>
        </AbsoluteFill>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
