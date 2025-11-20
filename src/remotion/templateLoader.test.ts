/**
 * Template Loader Tests
 */

import { describe, it, expect } from 'vitest';
import { TemplateLoader } from './templateLoader';

describe('TemplateLoader', () => {
  it('should return all available templates', () => {
    const templates = TemplateLoader.getAvailableTemplates();
    expect(templates).toContain('animated-text');
    expect(templates).toContain('bounce-text');
    expect(templates).toContain('slide-text');
    expect(templates.length).toBeGreaterThan(0);
  });

  it('should get template info', () => {
    const info = TemplateLoader.getTemplateInfo('animated-text');
    expect(info).toBeDefined();
    expect(info?.name).toBe('AnimatedText');
    expect(info?.category).toBe('text');
  });

  it('should validate template existence', () => {
    expect(TemplateLoader.templateExists('animated-text')).toBe(true);
    expect(TemplateLoader.templateExists('non-existent')).toBe(false);
  });

  it('should get template component', () => {
    const component = TemplateLoader.getTemplateComponent('animated-text');
    expect(component).toBeDefined();
  });

  it('should generate template list for LLM', () => {
    const list = TemplateLoader.generateTemplateListForLLM();
    expect(list).toContain('animated-text');
    expect(list).toContain('Character-by-character');
    expect(list).toContain('Parameters');
  });

  it('should return null for non-existent template', () => {
    const info = TemplateLoader.getTemplateInfo('non-existent' as any);
    expect(info).toBeNull();
  });
});
