import React from 'react';
import {AbsoluteFill, Sequence, Img, Video, staticFile} from 'remotion';
import type {Plan} from '../types';
import type {TimelineSegment} from './timeline';
import {BrollPlaceholder} from './BrollPlaceholder';

interface BrollLayerProps {
  plan: Plan;
  timeline: TimelineSegment[];
  fps: number;
}

export const BrollLayer: React.FC<BrollLayerProps> = ({plan, timeline, fps}) => {
  return (
    <AbsoluteFill>
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
          const brollStartFrame = segment.from;
          const brollDurationFrames = segment.duration;
          const mediaType = brollFile.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image';

          if (!assetPath) {
            return null;
          }

          return (
            <Sequence
              key={`broll-${segment.segment.id}-${index}`}
              from={brollStartFrame}
              durationInFrames={brollDurationFrames}
            >
              <AbsoluteFill>
                {mediaType === 'video' ? (
                  <Video
                    src={staticFile(assetPath)}
                    startFrom={plannedBroll.startAt ? plannedBroll.startAt * fps : 0}
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
        } else if (plannedBroll) {
          // Render placeholder if broll is planned but file is missing or not full screen
          const brollStartFrame = segment.from;
          const brollDurationFrames = segment.duration;
          const keyword = plannedBroll.id || segment.segment.label || segment.segment.title || 'broll';
          const mediaType = plannedBroll.file?.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image';

          return (
            <Sequence
              key={`broll-placeholder-${segment.segment.id}-${index}`}
              from={brollStartFrame}
              durationInFrames={brollDurationFrames}
            >
              <BrollPlaceholder
                title="B-roll Placeholder"
                subtitle={`Expected: ${keyword}`}
                keyword={keyword}
                mediaType={mediaType}
                variant="fullwidth"
              />
            </Sequence>
          );
        }
        return null;
      })}
    </AbsoluteFill>
  );
};
