import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';
import { REMOTION_CONFIG, secondsToFrames } from './config';

/**
 * Remotion Root Component
 * Registers all available compositions
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoComposition"
        component={VideoComposition as any}
        durationInFrames={REMOTION_CONFIG.defaultDurationInFrames}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        defaultProps={{
          videoPath: '',
          videoDuration: 0,
          videoWidth: 1920,
          videoHeight: 1080,
          editingPlan: {
            highlights: [],
            animations: [],
            transitions: [],
            brollPlacements: [],
          },
          subtitles: [],
          brollVideos: [],
        }}
        // Calculate duration dynamically based on input props
        calculateMetadata={({ props }: any) => {
          const durationInFrames = secondsToFrames(
            props.videoDuration || 5,
            REMOTION_CONFIG.fps
          );

          return {
            durationInFrames,
            fps: REMOTION_CONFIG.fps,
            width: props.videoWidth || REMOTION_CONFIG.width,
            height: props.videoHeight || REMOTION_CONFIG.height,
          };
        }}
      />
    </>
  );
};
