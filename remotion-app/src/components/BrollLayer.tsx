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
        if (segment.segment.broll && segment.segment.broll.file && segment.segment.broll.mode === 'full') {
          const brollFile = segment.segment.broll.file;
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
                    startFrom={segment.segment.broll.startAt ? segment.segment.broll.startAt * fps : 0}
                    playbackRate={segment.segment.broll.playbackRate ?? 1}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Img
                    src={staticFile(assetPath)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    placeholder={`data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=`}
                  />
                )}
              </AbsoluteFill>
            </Sequence>
          );
        } else if (segment.segment.broll && segment.segment.broll.mode === 'full') {
          // Render placeholder if broll is planned but file is missing or not full screen
          const brollStartFrame = segment.from;
          const brollDurationFrames = segment.duration;
          const keyword = segment.segment.broll.id || segment.segment.label || segment.segment.title || 'broll';
          const mediaType = segment.segment.broll.file?.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image';

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
