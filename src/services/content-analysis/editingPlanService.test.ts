import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditingPlanService } from './editingPlanService';
import type { EditingPlanInput, EditingPlan } from './editingPlanService';

// Mock the config
vi.mock('../../config', () => ({
  config: {
    gemini: {
      apiKey: 'test-api-key',
      model: 'gemini-pro',
    },
  },
}));

// Mock the logger
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the template loader
vi.mock('../../remotion/templateLoader', () => ({
  TemplateLoader: {
    generateTemplateListForLLM: () => 'Available templates: animated-text, bounce-text',
    templateExists: (name: string) => ['animated-text', 'bounce-text', 'slide-text'].includes(name),
    getAvailableTemplates: () => ['animated-text', 'bounce-text', 'slide-text'],
  },
}));

describe('EditingPlanService', () => {
  let service: EditingPlanService;

  beforeEach(() => {
    service = new EditingPlanService();
  });

  describe('validatePlan', () => {
    it('should accept valid editing plan', () => {
      const plan: EditingPlan = {
        highlights: [
          {
            startTime: 1.0,
            endTime: 3.0,
            effectType: 'zoom',
            parameters: {},
          },
        ],
        animations: [
          {
            startTime: 5.0,
            duration: 2.0,
            template: 'animated-text',
            text: 'Hello',
            parameters: {},
          },
        ],
        transitions: [
          {
            time: 10.0,
            type: 'fade',
            duration: 0.5,
          },
        ],
        brollPlacements: [
          {
            startTime: 15.0,
            duration: 3.0,
            searchTerm: 'nature',
          },
        ],
      };

      // Should not throw
      expect(() => (service as any).validatePlan(plan, 30.0)).not.toThrow();
    });

    it('should reject highlight with invalid timestamps', () => {
      const plan: EditingPlan = {
        highlights: [
          {
            startTime: 5.0,
            endTime: 3.0, // end before start
            effectType: 'zoom',
            parameters: {},
          },
        ],
        animations: [],
        transitions: [],
        brollPlacements: [],
      };

      expect(() => (service as any).validatePlan(plan, 30.0)).toThrow(
        /Invalid highlight: start time.*>= end time/
      );
    });

    it('should reject highlight with out-of-bounds timestamps', () => {
      const plan: EditingPlan = {
        highlights: [
          {
            startTime: 1.0,
            endTime: 35.0, // beyond video duration
            effectType: 'zoom',
            parameters: {},
          },
        ],
        animations: [],
        transitions: [],
        brollPlacements: [],
      };

      expect(() => (service as any).validatePlan(plan, 30.0)).toThrow(
        /Invalid highlight timestamp/
      );
    });

    it('should reject animation with non-existent template', () => {
      const plan: EditingPlan = {
        highlights: [],
        animations: [
          {
            startTime: 5.0,
            duration: 2.0,
            template: 'non-existent-template',
            parameters: {},
          },
        ],
        transitions: [],
        brollPlacements: [],
      };

      expect(() => (service as any).validatePlan(plan, 30.0)).toThrow(
        /Animation template does not exist/
      );
    });

    it('should reject animation with invalid duration', () => {
      const plan: EditingPlan = {
        highlights: [],
        animations: [
          {
            startTime: 5.0,
            duration: -1.0, // negative duration
            template: 'animated-text',
            parameters: {},
          },
        ],
        transitions: [],
        brollPlacements: [],
      };

      expect(() => (service as any).validatePlan(plan, 30.0)).toThrow(
        /Invalid animation duration/
      );
    });

    it('should reject transition with invalid type', () => {
      const plan: EditingPlan = {
        highlights: [],
        animations: [],
        transitions: [
          {
            time: 10.0,
            type: 'invalid-type' as any,
            duration: 0.5,
          },
        ],
        brollPlacements: [],
      };

      expect(() => (service as any).validatePlan(plan, 30.0)).toThrow(
        /Invalid transition type/
      );
    });

    it('should reject B-roll with empty search term', () => {
      const plan: EditingPlan = {
        highlights: [],
        animations: [],
        transitions: [],
        brollPlacements: [
          {
            startTime: 5.0,
            duration: 3.0,
            searchTerm: '', // empty search term
          },
        ],
      };

      expect(() => (service as any).validatePlan(plan, 30.0)).toThrow(
        /B-roll placement must have a search term/
      );
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const jsonResponse = JSON.stringify({
        highlights: [{ startTime: 1, endTime: 2, effectType: 'zoom', parameters: {} }],
        animations: [],
        transitions: [],
        brollPlacements: [],
      });

      const plan = (service as any).parseResponse(jsonResponse);

      expect(plan).toHaveProperty('highlights');
      expect(plan).toHaveProperty('animations');
      expect(plan).toHaveProperty('transitions');
      expect(plan).toHaveProperty('brollPlacements');
      expect(plan.highlights).toHaveLength(1);
    });

    it('should parse JSON wrapped in markdown code blocks', () => {
      const jsonResponse = `\`\`\`json
{
  "highlights": [],
  "animations": [],
  "transitions": [],
  "brollPlacements": []
}
\`\`\``;

      const plan = (service as any).parseResponse(jsonResponse);

      expect(plan).toHaveProperty('highlights');
      expect(plan.highlights).toHaveLength(0);
    });

    it('should handle missing fields with defaults', () => {
      const jsonResponse = JSON.stringify({
        highlights: [{ startTime: 1, endTime: 2, effectType: 'zoom', parameters: {} }],
        // missing animations, transitions, brollPlacements
      });

      const plan = (service as any).parseResponse(jsonResponse);

      expect(plan.animations).toEqual([]);
      expect(plan.transitions).toEqual([]);
      expect(plan.brollPlacements).toEqual([]);
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = 'This is not JSON';

      expect(() => (service as any).parseResponse(invalidJson)).toThrow(
        /Failed to parse editing plan JSON/
      );
    });
  });

  describe('buildPrompt', () => {
    it('should include transcript in prompt', () => {
      const input: EditingPlanInput = {
        transcript: [
          { start: 0, end: 2, text: 'Hello world' },
          { start: 2, end: 4, text: 'This is a test' },
        ],
        highlights: [],
        videoDuration: 10.0,
      };

      const prompt = (service as any).buildPrompt(input);

      expect(prompt).toContain('Hello world');
      expect(prompt).toContain('This is a test');
      expect(prompt).toContain('[0.00s - 2.00s]');
    });

    it('should include highlights in prompt', () => {
      const input: EditingPlanInput = {
        transcript: [],
        highlights: [
          { startTime: 1, endTime: 3, confidence: 0.9, reason: 'Important moment' },
        ],
        videoDuration: 10.0,
      };

      const prompt = (service as any).buildPrompt(input);

      expect(prompt).toContain('Important moment');
      expect(prompt).toContain('confidence: 0.9');
    });

    it('should include video duration in prompt', () => {
      const input: EditingPlanInput = {
        transcript: [],
        highlights: [],
        videoDuration: 45.5,
      };

      const prompt = (service as any).buildPrompt(input);

      expect(prompt).toContain('45.50 seconds');
    });

    it('should include available templates in prompt', () => {
      const input: EditingPlanInput = {
        transcript: [],
        highlights: [],
        videoDuration: 10.0,
      };

      const prompt = (service as any).buildPrompt(input);

      expect(prompt).toContain('Available templates');
    });
  });
});
