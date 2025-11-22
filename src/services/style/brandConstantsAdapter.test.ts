/**
 * Brand Constants Adapter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  crownMercadoBrandKit,
  getBrandColors,
  getBrandTypography,
  getBrandPatterns,
  getBrandTiming,
  getCrownMercadoBrand,
} from './brandConstantsAdapter';

describe('Brand Constants Adapter', () => {
  describe('crownMercadoBrandKit', () => {
    it('should convert Crown Mercado constants to BrandKit format', () => {
      const brandKit = crownMercadoBrandKit();

      expect(brandKit.name).toBe('Crown Mercado');
      expect(brandKit.version).toBe('1.0.0');
      expect(brandKit.colors.primary).toBe('#C8102E'); // Crown Mercado red
      expect(brandKit.colors.secondary).toBe('#1C1C1C'); // Charcoal
      expect(brandKit.typography.fontFamily).toBe('Montserrat, sans-serif');
      expect(brandKit.animationPreferences.styleFamily).toBe('professional');
    });

    it('should include geometric-patterns in preferred templates', () => {
      const brandKit = crownMercadoBrandKit();

      expect(brandKit.animationPreferences.preferredTemplates).toContain('geometric-patterns');
    });

    it('should have valid transition duration (300-500ms)', () => {
      const brandKit = crownMercadoBrandKit();

      expect(brandKit.transitionPreferences.duration).toBeGreaterThanOrEqual(300);
      expect(brandKit.transitionPreferences.duration).toBeLessThanOrEqual(500);
    });

    it('should have valid saturation range (0.5-1.5)', () => {
      const brandKit = crownMercadoBrandKit();

      expect(brandKit.effectPreferences.intensity.saturation).toBeGreaterThanOrEqual(0.5);
      expect(brandKit.effectPreferences.intensity.saturation).toBeLessThanOrEqual(1.5);
    });

    it('should have valid contrast range (0.8-1.3)', () => {
      const brandKit = crownMercadoBrandKit();

      expect(brandKit.effectPreferences.intensity.contrast).toBeGreaterThanOrEqual(0.8);
      expect(brandKit.effectPreferences.intensity.contrast).toBeLessThanOrEqual(1.3);
    });

    it('should have valid vignette range (0.1-0.15)', () => {
      const brandKit = crownMercadoBrandKit();

      expect(brandKit.effectPreferences.intensity.vignette).toBeGreaterThanOrEqual(0.1);
      expect(brandKit.effectPreferences.intensity.vignette).toBeLessThanOrEqual(0.15);
    });
  });

  describe('getBrandColors', () => {
    it('should return Crown Mercado colors', () => {
      const colors = getBrandColors();

      expect(colors.primaryRed).toBe('#C8102E');
      expect(colors.charcoal).toBe('#1C1C1C');
      expect(colors.white).toBe('#FFFFFF');
      expect(colors.lightGray).toBe('#F2F2F2');
    });
  });

  describe('getBrandTypography', () => {
    it('should return Crown Mercado typography', () => {
      const typography = getBrandTypography();

      expect(typography.headlineFont).toBe('Montserrat, sans-serif');
      expect(typography.bodyFont).toBe('Open Sans, sans-serif');
      expect(typography.fontWeightBold).toBe('bold');
    });
  });

  describe('getBrandPatterns', () => {
    it('should return Crown Mercado triangle patterns', () => {
      const patterns = getBrandPatterns();

      expect(patterns.triangles.primary.color1).toBe('#C8102E');
      expect(patterns.triangles.primary.color2).toBe('#A0081E');
      expect(patterns.triangles.primary.color3).toBe('#8B0000');
    });
  });

  describe('getBrandTiming', () => {
    it('should return Crown Mercado animation timing', () => {
      const timing = getBrandTiming();

      expect(timing.fadeIn).toBe(15); // frames
      expect(timing.fadeOut).toBe(15);
      expect(timing.transition).toBe(30);
      expect(timing.highlight).toBe(45);
    });

    it('should have spring physics configuration', () => {
      const timing = getBrandTiming();

      expect(timing.spring.mass).toBe(0.8);
      expect(timing.spring.damping).toBe(12);
      expect(timing.spring.stiffness).toBe(100);
    });
  });

  describe('getCrownMercadoBrand', () => {
    it('should return complete brand theme', () => {
      const brand = getCrownMercadoBrand();

      expect(brand.colors).toBeDefined();
      expect(brand.typography).toBeDefined();
      expect(brand.timing).toBeDefined();
      expect(brand.patterns).toBeDefined();
      expect(brand.layout).toBeDefined();
    });
  });

  describe('Brand Identity Validation', () => {
    it('should match Crown Mercado brand essence', () => {
      const brandKit = crownMercadoBrandKit();

      // Bold, innovative, visionary → professional style family
      expect(brandKit.animationPreferences.styleFamily).toBe('professional');

      // Red as primary color (bold)
      expect(brandKit.colors.primary).toBe('#C8102E');

      // Charcoal for professional look
      expect(brandKit.colors.secondary).toBe('#1C1C1C');

      // Montserrat for modern, bold headlines
      expect(brandKit.typography.fontFamily).toContain('Montserrat');
    });

    it('should support layered triangles graphic motif', () => {
      const brandKit = crownMercadoBrandKit();
      const patterns = getBrandPatterns();

      // geometric-patterns template for triangles
      expect(brandKit.animationPreferences.preferredTemplates).toContain('geometric-patterns');

      // Red gradient triangles
      expect(patterns.triangles.primary.color1).toBe('#C8102E');
      expect(patterns.triangles.primary.color2).toBe('#A0081E');
      expect(patterns.triangles.primary.color3).toBe('#8B0000');
    });
  });
});
