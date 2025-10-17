import {Audio, Sequence, staticFile} from 'remotion';
import {SFX_CATALOG} from '../data/sfxCatalog';
import type {HighlightPlan} from '../types';
import {resolveIconVisual} from '../icons/registry';
import type {TimelineSegment} from './timeline';
import type {RuntimeConfig} from '../config';

/**
 * A lookup map for SFX assets, allowing retrieval by various normalized keys.
 * This helps in robustly matching SFX names from the plan.
 */
const SFX_LOOKUP = (() => {
  const entries = new Map<string, string>();

  for (const relativePath of SFX_CATALOG) {
    // Ensure canonical path starts with 'assets/'
    const canonical = relativePath.startsWith('assets/') ? relativePath : `assets/sfx/${relativePath}`;
    const withoutPrefix = canonical.replace(/^assets\//, '');
    const lowerCanonical = canonical.toLowerCase();
    const lowerRelative = withoutPrefix.toLowerCase();

    entries.set(lowerCanonical, canonical);
    entries.set(lowerRelative, canonical);

    const fileName = withoutPrefix.split('/').pop();
    if (fileName) {
      const lowerFileName = fileName.toLowerCase();
      entries.set(lowerFileName, canonical);

      const stem = lowerFileName.replace(/\.[^.]+$/, ''); // Filename without extension
      entries.set(stem, canonical);
    }
  }

  return entries;
})();

/**
 * Strips the Remotion static file hash prefix (e.g., 'static-hash/').
 * @param value The string to strip.
 * @returns The string without the static hash prefix.
 */
const stripStaticHash = (value: string) => value.replace(/^static-[^/]+\//, '');

/**
 * Normalizes an SFX path or name to a canonical 'assets/sfx/...' format.
 * It tries to match against `SFX_LOOKUP` for known assets.
 * @param value The raw SFX path or name.
 * @returns The normalized SFX path or null if it cannot be resolved.
 */
const normalizeSfx = (value: string | undefined | null): string | null => {
  if (!value) {
    return null;
  }

  // Sanitize input: strip static hash, normalize slashes, remove leading './', trim whitespace
  const sanitized = stripStaticHash(value)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();

  if (!sanitized) {
    return null;
  }

  const lower = sanitized.toLowerCase();
  const withoutAssets = lower.startsWith('assets/') ? lower.slice(7) : lower;
  const withoutSfx = withoutAssets.startsWith('sfx/') ? withoutAssets.slice(4) : withoutAssets;

  // Generate various candidate keys to check against SFX_LOOKUP
  const candidates = [
    lower, // Full lowercased path
    withoutAssets, // Path without 'assets/' prefix
    withoutSfx, // Path without 'assets/sfx/' prefix
    `assets/${withoutAssets}`, // Re-add 'assets/' prefix
    `assets/sfx/${withoutSfx}`, // Re-add 'assets/sfx/' prefix
    `sfx/${withoutSfx}`, // Re-add 'sfx/' prefix
  ];

  const fileName = sanitized.split('/').pop();
  if (fileName) {
    candidates.push(fileName.toLowerCase()); // Filename only
    candidates.push(fileName.replace(/\.[^.]+$/, '').toLowerCase()); // Filename stem
  }

  // Check candidates against the lookup map
  for (const key of candidates) {
    const match = SFX_LOOKUP.get(key);
    if (match) {
      return match;
    }
  }

  // Fallback: if it looks like a path, return it as is (might be an external asset)
  if (sanitized.startsWith('assets/')) {
    return sanitized;
  }

  if (sanitized.startsWith('sfx/')) {
    return `assets/${sanitized}`;
  }

  if (sanitized.includes('/')) {
    return `assets/sfx/${sanitized}`;
  }

  // Last resort: assume it's a filename and prepend default path
  return `assets/sfx/${sanitized}`;
};

/**
 * Converts decibels (dB) to a linear gain value.
 * @param db The decibel value.
 * @returns The linear gain value.
 */
const dbToGain = (db: number) => Math.pow(10, db / 20);

/**
 * Represents a single sound effect event to be played.
 */
interface SfxEvent {
  id: string;
  startFrame: number;
  durationInFrames: number;
  src: string;
  gainDb?: number;
  ducking: boolean;
}

/**
 * Extracts SFX event properties from a `HighlightPlan`.
 * @param highlight The highlight plan.
 * @param fps The video's frames per second.
 * @returns A partial `SfxEvent` object with timing and gain/ducking info.
 */
const eventFromHighlight = (
  highlight: HighlightPlan,
  fps: number
): Pick<SfxEvent, 'startFrame' | 'durationInFrames' | 'gainDb' | 'ducking'> => {
  const startFrame = Math.round(highlight.start * fps);
  const durationInFrames = Math.max(1, Math.round(highlight.duration * fps));
  let gainDb = highlight.gain;
  // Convert volume (0-1) to dB if gainDb is not explicitly set
  if (gainDb == null && typeof highlight.volume === 'number' && highlight.volume > 0) {
    gainDb = 20 * Math.log10(highlight.volume);
  }

  return {
    startFrame,
    durationInFrames,
    gainDb,
    ducking: highlight.ducking !== false, // Default to true if not explicitly false
  };
};

/**
 * Collects SFX events triggered by segment transitions.
 * @param timeline The computed timeline segments.
 * @param fps The video's frames per second.
 * @returns An array of `SfxEvent` objects for transitions.
 */
const collectTransitionEvents = (
  timeline: TimelineSegment[],
  fps: number
): SfxEvent[] => {
  const events: SfxEvent[] = [];

  timeline.forEach((segment, index) => {
    const plan = segment.segment;
    const transition = plan.transitionOut;
    if (!transition?.sfx) {
      return; // Skip if no SFX is defined for the transition
    }
    // Calculate start frame for the transition SFX (at the end of the segment)
    const startFrame = segment.from + Math.max(0, segment.duration - segment.transitionOutFrames);
    const durationSeconds = transition.duration ?? segment.transitionOutFrames / fps;
    const durationInFrames = Math.max(1, Math.round(durationSeconds * fps));
    const normalized = normalizeSfx(transition.sfx);
    if (!normalized) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Could not resolve transition SFX asset for segment ${plan.id}`);
      }
      return;
    }

    events.push({
      id: `${plan.id}-transition-${index}`,
      startFrame,
      durationInFrames,
      src: normalized,
      ducking: false, // Transitions typically don't duck voice
    });
  });

  return events;
};

/**
 * Collects SFX events triggered by highlights.
 * @param highlights An array of `HighlightPlan` objects.
 * @param fps The video's frames per second.
 * @returns An array of `SfxEvent` objects for highlights.
 */
const collectHighlightEvents = (highlights: HighlightPlan[], fps: number): SfxEvent[] => {
  const events: SfxEvent[] = [];

  highlights.forEach((highlight) => {
    // Resolve fallback SFX for icon highlights if not explicitly set
    const iconFallback =
      (highlight.type ?? 'noteBox') === 'icon'
        ? resolveIconVisual(
            typeof highlight.icon === 'string' && highlight.icon.trim()
              ? highlight.icon
              : typeof highlight.name === 'string' && highlight.name.trim()
                ? highlight.name
                : undefined
          )?.defaultSfx
        : undefined;

    const requestedSfx = highlight.sfx ?? iconFallback;

    if (!requestedSfx) {
      return; // Skip if no SFX is requested or resolved
    }
    const normalized = normalizeSfx(requestedSfx);
    if (!normalized) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Could not resolve SFX asset for highlight ${highlight.id}`);
      }
      return;
    }

    const timings = eventFromHighlight(highlight, fps);
    events.push({
      id: `highlight-${highlight.id}`,
      src: normalized,
      ...timings,
    });
  });

  return events;
};

/**
 * Builds a volume envelope function for an SFX event.
 * This function determines the gain at any given frame, applying base gain,
 * ducking (if enabled), and fade in/out effects.
 * @param event The SFX event.
 * @param audioConfig The audio configuration settings.
 * @param fps The video's frames per second.
 * @returns A function that takes a frame number and returns the calculated gain.
 */
const buildVolumeEnvelope = (
  event: SfxEvent,
  audioConfig: RuntimeConfig['audio'],
  fps: number
) => {
  const baseDb = event.gainDb ?? audioConfig.sfxBaseGainDb;
  const baseGain = Math.min(dbToGain(baseDb), dbToGain(-6)); // Cap base gain
  const duckGain = dbToGain(audioConfig.voiceDuckDb);
  
  // Define frame durations for various audio effects
  const attackFrames = Math.max(1, Math.round(fps * 0.3));
  const releaseFrames = Math.max(1, Math.round(fps * 0.3));
  const fadeInFrames = Math.max(1, Math.round(fps * 0.12));
  const fadeOutFrames = Math.max(1, Math.round(fps * 0.16));

  return (frame: number) => {
    // Calculate progress for ducking, fade in, fade out, and release
    const duckProgress = Math.min(frame / attackFrames, 1);
    const fadeIn = Math.min(frame / fadeInFrames, 1);
    const fadeOut = Math.min((event.durationInFrames - frame) / fadeOutFrames, 1);
    const release = Math.min((event.durationInFrames - frame) / releaseFrames, 1);
    
    // Calculate ducking multiplier
    const duckMultiplier = event.ducking ? duckGain + (1 - duckGain) * duckProgress : 1;
    
    // Combine all factors to get the final amplitude
    const amplitude = baseGain * duckMultiplier * fadeIn * Math.max(0, fadeOut) * Math.max(0, release);
    return Math.min(amplitude, dbToGain(-6)); // Ensure amplitude is capped
  };
};

/**
 * Props for the `SfxLayer` component.
 */
interface SfxLayerProps {
  /** An array of highlight plans. */
  highlights: HighlightPlan[];
  /** The computed timeline segments. */
  timeline: TimelineSegment[];
  /** The video's frames per second. */
  fps: number;
  /** Audio configuration settings. */
  audioConfig: RuntimeConfig['audio'];
}

/**
 * Renders all sound effects for the composition, including those from highlights and transitions.
 * Applies volume envelopes for dynamic audio mixing.
 * @param props - The component props.
 */
export const SfxLayer: React.FC<SfxLayerProps> = ({highlights, timeline, fps, audioConfig}) => {
  // Collect all SFX events and sort them by start frame
  const events = [...collectHighlightEvents(highlights, fps), ...collectTransitionEvents(timeline, fps)].sort(
    (a, b) => a.startFrame - b.startFrame
  );

  return (
    <>
      {events.map((event) => {
        const resolved = normalizeSfx(event.src);
        if (!resolved) {
          return null; // Skip if SFX source cannot be resolved
        }
        const src = staticFile(resolved); // Resolve to Remotion static file URL
        return (
          <Sequence
            key={`sfx-${event.id}`}
            from={event.startFrame}
            durationInFrames={event.durationInFrames}
            name={`sfx-${event.id}`}
          >
            {/* Render the Audio component with a dynamic volume envelope */}
            <Audio src={src} volume={buildVolumeEnvelope(event, audioConfig, fps)} />
          </Sequence>
        );
      })}
    </>
  );
};
