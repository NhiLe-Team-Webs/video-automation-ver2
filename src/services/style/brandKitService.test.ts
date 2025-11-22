/**
 * Brand Kit Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { BrandKitService, BrandKit, VideoMetadata } from './brandKitService';

describe('BrandKitService', () => {
  let service: BrandKitService;
  let testBrandKitPath: string;

  beforeEach(() => {
    testBrandKitPath = path.join(process.cwd(), 'temp', 'test-brand-kit.json');
    service = new BrandKitService(testBrandKitPath);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(testBrandKitPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('loadBrandKit', () => {
    it('should load valid brand kit from file', async () => {
      const validBrandKit: BrandKit = {
        name: 'Test Brand',
        version: '1.0.0',
        colors: {
          primary: '#2563eb',
          secondary: '#7c3aed',
          accent: '#f59e0b',
          textColor: '#ffffff',
          backgroundColor: '#1f2937',
        },
        typography: {
          fontFamily: 'Inter, sans-serif',
          fontSize: {
            small: 24,
            medium: 48,
            large: 72,
          },
          fontWeight: 700,
          lineHeight: 1.2,
        },
        animationPreferences: {
          styleFamily: 'professional',
          preferredTemplates: ['animated-text', 'slide-text'],
          timing: {
            textAppearDuration: 300,
            textDisappearDuration: 200,
            transitionDuration: 400,
            zoomDuration: 400,
          },
        },
        transitionPreferences: {
          type: 'fade',
          duration: 400,
          easing: 'ease-in-out',
        },
        effectPreferences: {
          intensity: {
            colorGrading: 0.3,
            contrast: 1.1,
            saturation: 1.1,
            sharpness: 0.2,
            vignette: 0.12,
          },
        },
      };

      // Create test file
      await fs.mkdir(path.dirname(testBrandKitPath), { recursive: true });
      await fs.writeFile(testBrandKitPath, JSON.stringify(validBrandKit, null, 2));

      const loadedBrandKit = await service.loadBrandKit();

      expect(loadedBrandKit.name).toBe('Test Brand');
      expect(loadedBrandKit.version).toBe('1.0.0');
      expect(loadedBrandKit.colors.primary).toBe('#2563eb');
      expect(loadedBrandKit.animationPreferences.styleFamily).toBe('professional');
    });

    it('should return default brand kit if file not found', async () => {
      const brandKit = await service.loadBrandKit();

      expect(brandKit.name).toBe('Default Professional');
      expect(brandKit.animationPreferences.styleFamily).toBe('professional');
    });

    it('should reject invalid style family', async () => {
      const invalidBrandKit = {
        name: 'Invalid Brand',
        version: '1.0.0',
        colors: {
          primary: '#2563eb',
          secondary: '#7c3aed',
          accent: '#f59e0b',
          textColor: '#ffffff',
          backgroundColor: '#1f2937',
        },
        typography: {
          fontFamily: 'Inter',
          fontSize: { small: 24, medium: 48, large: 72 },
          fontWeight: 700,
          lineHeight: 1.2,
        },
        animationPreferences: {
          styleFamily: 'invalid-family', // Invalid
          preferredTemplates: [],
          timing: {
            textAppearDuration: 300,
            textDisappearDuration: 200,
            transitionDuration: 400,
            zoomDuration: 400,
          },
        },
        transitionPreferences: {
          type: 'fade',
          duration: 400,
          easing: 'ease-in-out',
        },
        effectPreferences: {
          intensity: {
            colorGrading: 0.3,
            contrast: 1.1,
            saturation: 1.1,
            sharpness: 0.2,
            vignette: 0.12,
          },
        },
      };

      await fs.mkdir(path.dirname(testBrandKitPath), { recursive: true });
      await fs.writeFile(testBrandKitPath, JSON.stringify(invalidBrandKit, null, 2));

      await expect(service.loadBrandKit()).rejects.toThrow('Invalid style family');
    });

    it('should reject transition duration outside 300-500ms range', async () => {
      const invalidBrandKit = {
        name: 'Invalid Brand',
        version: '1.0.0',
        colors: {
          primary: '#2563eb',
          secondary: '#7c3aed',
          accent: '#f59e0b',
          textColor: '#ffffff',
          backgroundColor: '#1f2937',
        },
        typography: {
          fontFamily: 'Inter',
          fontSize: { small: 24, medium: 48, large: 72 },
          fontWeight: 700,
          lineHeight: 1.2,
        },
        animationPreferences: {
          styleFamily: 'professional',
          preferredTemplates: [],
          timing: {
            textAppearDuration: 300,
            textDisappearDuration: 200,
            transitionDuration: 400,
            zoomDuration: 400,
          },
        },
        transitionPreferences: {
          type: 'fade',
          duration: 600, // Invalid: > 500ms
          easing: 'ease-in-out',
        },
        effectPreferences: {
          intensity: {
            colorGrading: 0.3,
            contrast: 1.1,
            saturation: 1.1,
            sharpness: 0.2,
            vignette: 0.12,
          },
        },
      };

      await fs.mkdir(path.dirname(testBrandKitPath), { recursive: true });
      await fs.writeFile(testBrandKitPath, JSON.stringify(invalidBrandKit, null, 2));

      await expect(service.loadBrandKit()).rejects.toThrow(
        'Transition duration must be between 300-500ms'
      );
    });

    it('should reject saturation outside valid range', async () => {
      const invalidBrandKit = {
        name: 'Invalid Brand',
        version: '1.0.0',
        colors: {
          primary: '#2563eb',
          secondary: '#7c3aed',
          accent: '#f59e0b',
          textColor: '#ffffff',
          backgroundColor: '#1f2937',
        },
        typography: {
          fontFamily: 'Inter',
          fontSize: { small: 24, medium: 48, large: 72 },
          fontWeight: 700,
          lineHeight: 1.2,
        },
        animationPreferences: {
          styleFamily: 'professional',
          preferredTemplates: [],
          timing: {
            textAppearDuration: 300,
            textDisappearDuration: 200,
            transitionDuration: 400,
            zoomDuration: 400,
          },
        },
        transitionPreferences: {
          type: 'fade',
          duration: 400,
          easing: 'ease-in-out',
        },
        effectPreferences: {
          intensity: {
            colorGrading: 0.3,
            contrast: 1.1,
            saturation: 2.0, // Invalid: > 1.5
            sharpness: 0.2,
            vignette: 0.12,
          },
        },
      };

      await fs.mkdir(path.dirname(testBrandKitPath), { recursive: true });
      await fs.writeFile(testBrandKitPath, JSON.stringify(invalidBrandKit, null, 2));

      await expect(service.loadBrandKit()).rejects.toThrow(
        'Saturation must be between 0.5 and 1.5'
      );
    });
  });

  describe('generateStyleGuide', () => {
    it('should generate style guide from brand kit and video metadata', async () => {
      await service.loadBrandKit(); // Load default

      const videoMetadata: VideoMetadata = {
        duration: 120,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        aspectRatio: '16:9',
      };

      const styleGuide = await service.generateStyleGuide(videoMetadata);

      expect(styleGuide.videoMetadata.duration).toBe(120);
      expect(styleGuide.colorScheme.primary).toBeDefined();
      expect(styleGuide.typography.fontFamily).toBeDefined();
      expect(styleGuide.animationTiming.textAppearDuration).toBe(300);
      expect(styleGuide.transitionStyle.type).toBe('fade');
      expect(styleGuide.selectedTemplates.length).toBeGreaterThan(0);
    });

    it('should select templates based on style family', async () => {
      await service.loadBrandKit(); // Load default (professional)

      const videoMetadata: VideoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        aspectRatio: '16:9',
      };

      const styleGuide = await service.generateStyleGuide(videoMetadata);

      // Professional style should include these templates
      expect(styleGuide.selectedTemplates).toContain('animated-text');
      expect(styleGuide.selectedTemplates).toContain('slide-text');
    });
  });

  describe('validateStyleConsistency', () => {
    it('should validate consistent animation templates', async () => {
      await service.loadBrandKit();

      const videoMetadata: VideoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        aspectRatio: '16:9',
      };

      const styleGuide = await service.generateStyleGuide(videoMetadata);

      const editingPlan = {
        animations: [
          {
            startTime: 5,
            duration: 3,
            template: 'animated-text',
            text: 'Hello',
            parameters: {},
          },
          {
            startTime: 10,
            duration: 3,
            template: 'slide-text',
            text: 'World',
            parameters: {},
          },
        ],
        transitions: [],
        textHighlights: [],
      };

      const validation = service.validateStyleConsistency(editingPlan, styleGuide);

      expect(validation.isConsistent).toBe(true);
      expect(validation.violations.length).toBe(0);
    });

    it('should detect inconsistent animation templates', async () => {
      await service.loadBrandKit();

      const videoMetadata: VideoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        aspectRatio: '16:9',
      };

      const styleGuide = await service.generateStyleGuide(videoMetadata);

      const editingPlan = {
        animations: [
          {
            startTime: 5,
            duration: 3,
            template: 'matrix-rain', // Not in professional style
            text: 'Hello',
            parameters: {},
          },
        ],
        transitions: [],
        textHighlights: [],
      };

      const validation = service.validateStyleConsistency(editingPlan, styleGuide);

      expect(validation.isConsistent).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
      expect(validation.violations[0].property).toBe('template');
    });

    it('should detect inconsistent transition types', async () => {
      await service.loadBrandKit();

      const videoMetadata: VideoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        aspectRatio: '16:9',
      };

      const styleGuide = await service.generateStyleGuide(videoMetadata);

      const editingPlan = {
        animations: [],
        transitions: [
          { time: 10, type: 'fade', duration: 400 },
          { time: 20, type: 'slide', duration: 400 }, // Different type
        ],
        textHighlights: [],
      };

      const validation = service.validateStyleConsistency(editingPlan, styleGuide);

      expect(validation.isConsistent).toBe(false);
      const typeViolation = validation.violations.find(
        (v) => v.property === 'type-consistency'
      );
      expect(typeViolation).toBeDefined();
    });

    it('should detect transition duration outside bounds', async () => {
      await service.loadBrandKit();

      const videoMetadata: VideoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        aspectRatio: '16:9',
      };

      const styleGuide = await service.generateStyleGuide(videoMetadata);

      const editingPlan = {
        animations: [],
        transitions: [
          { time: 10, type: 'fade', duration: 600 }, // > 500ms
        ],
        textHighlights: [],
      };

      const validation = service.validateStyleConsistency(editingPlan, styleGuide);

      expect(validation.isConsistent).toBe(false);
      const durationViolation = validation.violations.find((v) => v.property === 'duration');
      expect(durationViolation).toBeDefined();
      expect(durationViolation?.expected).toBe('300-500ms');
    });
  });

  describe('applyStyleGuide', () => {
    it('should apply style guide to text element', async () => {
      await service.loadBrandKit();

      const videoMetadata: VideoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        aspectRatio: '16:9',
      };

      const styleGuide = await service.generateStyleGuide(videoMetadata);

      const element = {
        type: 'text' as const,
        properties: {
          text: 'Hello World',
        },
      };

      const styledElement = service.applyStyleGuide(element, styleGuide);

      expect(styledElement.properties.fontFamily).toBe(styleGuide.typography.fontFamily);
      expect(styledElement.properties.fontWeight).toBe(styleGuide.typography.fontWeight);
      expect(styledElement.properties.color).toBe(styleGuide.colorScheme.textColor);
    });

    it('should apply style guide to transition element', async () => {
      await service.loadBrandKit();

      const videoMetadata: VideoMetadata = {
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        format: 'mp4',
        aspectRatio: '16:9',
      };

      const styleGuide = await service.generateStyleGuide(videoMetadata);

      const element = {
        type: 'transition' as const,
        properties: {
          time: 10,
        },
      };

      const styledElement = service.applyStyleGuide(element, styleGuide);

      expect(styledElement.properties.type).toBe(styleGuide.transitionStyle.type);
      expect(styledElement.properties.duration).toBe(styleGuide.transitionStyle.duration);
      expect(styledElement.properties.easing).toBe(styleGuide.transitionStyle.easing);
    });
  });

  describe('saveBrandKit', () => {
    it('should save valid brand kit to file', async () => {
      const brandKit: BrandKit = {
        name: 'Test Save',
        version: '1.0.0',
        colors: {
          primary: '#2563eb',
          secondary: '#7c3aed',
          accent: '#f59e0b',
          textColor: '#ffffff',
          backgroundColor: '#1f2937',
        },
        typography: {
          fontFamily: 'Inter',
          fontSize: { small: 24, medium: 48, large: 72 },
          fontWeight: 700,
          lineHeight: 1.2,
        },
        animationPreferences: {
          styleFamily: 'professional',
          preferredTemplates: [],
          timing: {
            textAppearDuration: 300,
            textDisappearDuration: 200,
            transitionDuration: 400,
            zoomDuration: 400,
          },
        },
        transitionPreferences: {
          type: 'fade',
          duration: 400,
          easing: 'ease-in-out',
        },
        effectPreferences: {
          intensity: {
            colorGrading: 0.3,
            contrast: 1.1,
            saturation: 1.1,
            sharpness: 0.2,
            vignette: 0.12,
          },
        },
      };

      await service.saveBrandKit(brandKit);

      // Verify file was created
      const fileContent = await fs.readFile(testBrandKitPath, 'utf-8');
      const savedBrandKit = JSON.parse(fileContent);

      expect(savedBrandKit.name).toBe('Test Save');
      expect(savedBrandKit.version).toBe('1.0.0');
    });
  });
});
