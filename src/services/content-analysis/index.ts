// Export services
export { HighlightDetectionService } from './highlightDetectionService';
export { EditingPlanService } from './editingPlanService';

// Export types (avoiding duplicates)
export type {
  Highlight,
  TranscriptSegment,
} from './highlightDetectionService';

export type {
  EditingPlanInput,
  EditingPlan,
  HighlightEffect,
  AnimationEffect,
  TransitionEffect,
  BrollPlacement,
} from './editingPlanService';
