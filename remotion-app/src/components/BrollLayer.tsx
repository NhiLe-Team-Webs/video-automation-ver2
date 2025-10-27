import React from 'react';
import {AbsoluteFill, Sequence, Img, Video, staticFile} from 'remotion';
import type {Plan, HighlightPlan} from '../types';
import type {TimelineSegment} from './timeline';
import {BrollPlaceholder} from './BrollPlaceholder';

interface BrollLayerProps {
  plan: Plan;
  timeline: TimelineSegment[];
  fps: number;
}

interface FrameWindow {
  from: number;
  duration: number;
}

const toFrameWindow = (highlight: HighlightPlan, fps: number): FrameWindow | null => {
  if (typeof highlight.start !== 'number' || typeof highlight.duration !== 'number') {
    return null;
  }
  const startFrame = Math.max(0, Math.round(highlight.start * fps));
  const durationFrames = Math.max(1, Math.round(highlight.duration * fps));
  return {from: startFrame, duration: durationFrames};
};

const computeBrollWindows = (
  segment: TimelineSegment,
  highlights: HighlightPlan[],
  fps: number
): FrameWindow[] => {
  const segmentStart = segment.from;
  const segmentEnd = segmentStart + segment.duration;
  const padFrames = Math.max(0, Math.round(fps * 0.15));

  const overlapping = highlights
    .map((highlight) => toFrameWindow(highlight, fps))
    .filter((window): window is FrameWindow => Boolean(window))
    .map((window) => {
      const windowStart = window.from;
      const windowEnd = window.from + window.duration;
      if (windowEnd <= segmentStart || windowStart >= segmentEnd) {
        return null;
      }
      const paddedStart = Math.max(segmentStart, windowStart - padFrames);
      const paddedEnd = Math.min(segmentEnd, windowEnd + padFrames);
      if (paddedEnd <= paddedStart) {
        return null;
      }
      return {
        from: paddedStart,
        to: paddedEnd,
      };
    })
    .filter((window): window is {from: number; to: number} => Boolean(window))
    .sort((a, b) => a.from - b.from);

  if (!overlapping.length) {
    return [{from: segmentStart, duration: segment.duration}];
  }

  const merged: {from: number; to: number}[] = [];
  let current = overlapping[0];

  for (const next of overlapping.slice(1)) {
    if (next.from <= current.to + 1) {
      current = {
        from: current.from,
        to: Math.max(current.to, next.to),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged.map((window) => ({
    from: window.from,
    duration: Math.max(1, window.to - window.from),
  }));
};

export const BrollLayer: React.FC<BrollLayerProps> = ({plan, timeline, fps}) => {
  const highlights = plan.highlights ?? [];

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
      }}
    >
      {timeline.map((segment, index) => {
        const plannedBroll = segment.segment.broll;
        if (plannedBroll && plannedBroll.file) {
          const brollFile = plannedBroll.file;
          const assetPath = (() => {
            if (!brollFile) {
              return null;
            }
            let cleanedFile = brollFile;
            // Remove leading '/'
            if (cleanedFile.startsWith('/')) {
              cleanedFile = cleanedFile.slice(1);
            }
            // Remove leading 'assets/'
            if (cleanedFile.startsWith('assets/')) {
              cleanedFile = cleanedFile.substring('assets/'.length);
            }
            // Remove leading 'broll/'
            if (cleanedFile.startsWith('broll/')) {
              cleanedFile = cleanedFile.substring('broll/'.length);
            }
            // Always construct the path relative to the public/assets/
            return `assets/broll/${cleanedFile}`;
          })();
          const windows = computeBrollWindows(segment, highlights, fps);
          const mediaType = brollFile.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image';

          if (!assetPath) {
            return null;
          }

          return windows.map((window, windowIndex) => {
            const plannedFrames =
              typeof plannedBroll.duration === 'number'
                ? Math.max(1, Math.round(plannedBroll.duration * fps))
                : null;
            const effectiveDurationFrames = plannedFrames
              ? Math.min(window.duration, plannedFrames)
              : window.duration;
            const startFrameInClip = plannedBroll.startAt
              ? Math.max(0, Math.round(plannedBroll.startAt * fps))
              : 0;
            const videoEndFrame = startFrameInClip + effectiveDurationFrames;

            return (
            <Sequence
              key={`broll-${segment.segment.id}-${index}-${windowIndex}`}
              from={window.from}
              durationInFrames={effectiveDurationFrames}
            >
              <AbsoluteFill>
                {mediaType === 'video' ? (
                  <Video
                    src={staticFile(assetPath)}
                    startFrom={startFrameInClip}
                    endAt={videoEndFrame}
                    playbackRate={plannedBroll.playbackRate ?? 1}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      position: 'absolute',
                      inset: 0,
                    }}
                  />
                ) : (
                  <Img
                    src={staticFile(assetPath)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      position: 'absolute',
                      inset: 0,
                    }}
                    placeholder={`data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=`}
                  />
                )}
              </AbsoluteFill>
            </Sequence>
            );
          });
        } else if (plannedBroll) {
          // Render placeholder if broll is planned but file is missing or not full screen
          const windows = computeBrollWindows(segment, highlights, fps);
          const keyword = plannedBroll.id || segment.segment.label || segment.segment.title || 'broll';
          const mediaType = plannedBroll.file?.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image';

          return windows.map((window, windowIndex) => (
            <Sequence
              key={`broll-placeholder-${segment.segment.id}-${index}-${windowIndex}`}
              from={window.from}
              durationInFrames={window.duration}
            >
              <BrollPlaceholder
                title="B-roll Placeholder"
                subtitle={`Expected: ${keyword}`}
                keyword={keyword}
                mediaType={mediaType}
                variant="fullwidth"
              />
            </Sequence>
          ));
        }
        return null;
      })}
    </AbsoluteFill>
  );
};
