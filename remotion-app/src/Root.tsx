import type {CalculateMetadataFunction} from 'remotion';
import {Composition, staticFile} from 'remotion';
import {FinalComposition} from './components/FinalComposition';
import {buildTimelineMetadata} from './components/VideoTimeline';
import {
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from './config';
import {parsePlan} from './data/planSchema';
import type {FinalCompositionProps, Plan} from './types';

const DEFAULT_COMPOSITION_PROPS: FinalCompositionProps = {
  plan: null,
  planPath: 'input/plan.json',
  inputVideo: 'input/input.mp4',
  fallbackTransitionDuration: 0.75,
  highlightTheme: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    textColor: '#f8fafc',
    accentColor: '#38bdf8',
    fontFamily: "'Montserrat Black', 'Montserrat ExtraBold', 'Montserrat', sans-serif",
  },
  config: {},
};

type PathModuleWithDefault = typeof import('path') & {
  default?: typeof import('path');
};

/**
 * Removes leading slashes/backslashes and an optional 'public/' prefix from a path string.
 * @param value The path string to strip.
 * @returns The stripped path string.
 */
const stripPublicPrefix = (value: string): string =>
  value.replace(/^[/\\]+/, '').replace(/^public[/\\]+/i, '');

/**
 * Checks if a given string is an HTTP or HTTPS URL.
 * @param value The string to check.
 * @returns True if it's an HTTP(S) URL, false otherwise.
 */
const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

/**
 * Resolves a plan path to a browser-loadable URL.
 * If it's an HTTP URL, it's returned as is. Otherwise, it's treated as a static file.
 * @param planPath The path to the plan file.
 * @returns The resolved URL for the browser.
 */
const resolveBrowserPlanUrl = (planPath: string): string => {
  if (isHttpUrl(planPath)) {
    return planPath;
  }

  const normalized = stripPublicPrefix(planPath);
  return staticFile(normalized);
};

/**
 * Loads the content of a plan file, handling both Node.js (server-side) and browser (client-side) environments.
 * It can fetch from HTTP URLs or read from the local filesystem (in Node.js).
 * @param planPath The path or URL to the plan file.
 * @returns A promise that resolves with the file's content as a string.
 * @throws Error if fetching or reading the file fails.
 */
const loadPlanFileContents = async (planPath: string): Promise<string> => {
  if (typeof window === 'undefined') {
    // Node.js environment (server-side rendering or Remotion CLI)
    if (isHttpUrl(planPath)) {
      const response = await fetch(planPath);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch plan from ${planPath}: ${response.status} ${response.statusText}`
        );
      }

      return response.text();
    }

    // Dynamically import 'fs/promises' and 'path' for Node.js
    const fsModule = (await import(
      /* webpackIgnore: true */ 'fs/promises'
    )) as typeof import('fs/promises');
    const pathModuleRaw = (await import(
      /* webpackIgnore: true */ 'path'
    )) as PathModuleWithDefault;
    const pathModule = pathModuleRaw.default ?? pathModuleRaw;
    
    const sanitizedRelative = stripPublicPrefix(planPath);
    // Resolve absolute path for local file system access
    const absolutePlanPath = pathModule.isAbsolute(planPath)
      ? planPath
      : pathModule.join(process.cwd(), 'public', sanitizedRelative);

    return fsModule.readFile(absolutePlanPath, 'utf-8');
  }

  // Browser environment
  const response = await fetch(resolveBrowserPlanUrl(planPath), {
    cache: 'no-cache', // Always fetch fresh in browser
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch plan from ${planPath}: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
};

/**
 * Loads and parses a plan from a local disk path or URL.
 * @param planPath The path or URL to the plan file.
 * @returns A promise that resolves with the parsed Plan object.
 * @throws Error if the file cannot be loaded or parsed.
 */
const loadPlanFromDisk = async (planPath: string): Promise<Plan> => {
  const fileContents = await loadPlanFileContents(planPath);
  const parsed = JSON.parse(fileContents) as unknown;
  return parsePlan(parsed);
};

/**
 * Determines the active plan to use for the composition.
 * If `props.plan` is provided, it's used directly. Otherwise, `props.planPath` is used to load the plan.
 * @param props The FinalCompositionProps containing either a direct plan object or a path to it.
 * @returns A promise that resolves with the active Plan object.
 * @throws Error if no plan or planPath is provided, or if loading fails.
 */
const loadActivePlan = async (
  props: FinalCompositionProps
): Promise<Plan> => {
  if (props.plan) {
    return props.plan;
  }

  if (!props.planPath) {
    throw new Error(
      'No planPath provided. Supply a plan object or set planPath to a valid JSON file.'
    );
  }

  try {
    return await loadPlanFromDisk(props.planPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load plan from ${props.planPath}: ${message}`);
  }
};

/**
 * Calculates metadata for the Remotion composition, including total duration.
 * This function is called by Remotion to determine the video's length.
 * @param params Parameters provided by Remotion, including the component's props.
 * @returns A promise that resolves with the composition's metadata.
 */
const calculateMetadata: CalculateMetadataFunction<FinalCompositionProps> = async ({
  props,
}) => {
  // Merge default props with any provided overrides
  const mergedProps: FinalCompositionProps = {
    ...DEFAULT_COMPOSITION_PROPS,
    ...props,
    highlightTheme: {
      ...DEFAULT_COMPOSITION_PROPS.highlightTheme,
      ...(props.highlightTheme ?? {}),
    },
  };

  // Determine fallback transition duration
  const fallbackTransitionDuration =
    mergedProps.fallbackTransitionDuration ??
    DEFAULT_COMPOSITION_PROPS.fallbackTransitionDuration ??
    0.75;

  // Load the active plan
  const plan = await loadActivePlan(mergedProps);

  // Build timeline metadata to get the total duration in frames
  const {totalDurationInFrames} = buildTimelineMetadata(
    plan.segments,
    VIDEO_FPS,
    fallbackTransitionDuration
  );

  return {
    durationInFrames: Math.max(1, totalDurationInFrames),
  };
};

/**
 * The main Remotion root component.
 * It defines the primary video composition and its properties.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FinalVideo"
      component={FinalComposition}
      calculateMetadata={calculateMetadata}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={DEFAULT_COMPOSITION_PROPS}
    />
  );
};
