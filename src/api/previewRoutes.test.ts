/**
 * Preview Routes Tests
 * 
 * Unit tests for preview API endpoints
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { previewRouter, previewErrorHandler } from './previewRoutes';

describe('Preview Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/preview', previewRouter);
    app.use(previewErrorHandler);
  });

  describe('GET /api/preview/templates', () => {
    it('should return list of available templates', async () => {
      const response = await request(app)
        .get('/api/preview/templates')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data).toBe('object');
    });
  });

  describe('GET /api/preview/transitions', () => {
    it('should return list of available transitions', async () => {
      const response = await request(app)
        .get('/api/preview/transitions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data).toBe('object');
    });
  });

  describe('POST /api/preview/animation', () => {
    it('should reject request without template', async () => {
      const response = await request(app)
        .post('/api/preview/animation')
        .send({ parameters: {} })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Template name is required');
    });

    it('should reject request without parameters', async () => {
      const response = await request(app)
        .post('/api/preview/animation')
        .send({ template: 'animated-text' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Parameters object is required');
    });

    it('should reject invalid template', async () => {
      const response = await request(app)
        .post('/api/preview/animation')
        .send({
          template: 'invalid-template',
          parameters: { text: 'Test' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/preview/transition', () => {
    it('should reject request without type', async () => {
      const response = await request(app)
        .post('/api/preview/transition')
        .send({ videoSegments: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Transition type is required');
    });

    it('should reject request with less than 2 segments', async () => {
      const response = await request(app)
        .post('/api/preview/transition')
        .send({
          type: 'fade',
          videoSegments: [{ videoPath: '/test.mp4', startTime: 0, endTime: 5 }]
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('At least 2 video segments are required');
    });

    it('should reject invalid video segment format', async () => {
      const response = await request(app)
        .post('/api/preview/transition')
        .send({
          type: 'fade',
          videoSegments: [
            { videoPath: '/test1.mp4' }, // Missing startTime and endTime
            { videoPath: '/test2.mp4', startTime: 0, endTime: 5 }
          ]
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid video segment format');
    });
  });

  describe('POST /api/preview/effect', () => {
    it('should reject request without effect', async () => {
      const response = await request(app)
        .post('/api/preview/effect')
        .send({ videoPath: '/test.mp4' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Effect configuration is required');
    });

    it('should reject request without videoPath', async () => {
      const response = await request(app)
        .post('/api/preview/effect')
        .send({
          effect: {
            type: 'zoom',
            parameters: {},
            startTime: 0,
            duration: 2
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Video path is required');
    });

    it('should reject invalid effect configuration', async () => {
      const response = await request(app)
        .post('/api/preview/effect')
        .send({
          effect: { type: 'zoom' }, // Missing startTime and duration
          videoPath: '/test.mp4'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid effect configuration');
    });
  });

  describe('POST /api/preview/full-video', () => {
    it('should reject request without editingPlan', async () => {
      const response = await request(app)
        .post('/api/preview/full-video')
        .send({ videoPath: '/test.mp4' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Editing plan is required');
    });

    it('should reject request without videoPath', async () => {
      const response = await request(app)
        .post('/api/preview/full-video')
        .send({
          editingPlan: {
            highlights: [],
            animations: [],
            transitions: [],
            brollPlacements: []
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Video path is required');
    });

    it('should reject invalid editing plan structure', async () => {
      const response = await request(app)
        .post('/api/preview/full-video')
        .send({
          editingPlan: { highlights: 'invalid' }, // Should be array
          videoPath: '/test.mp4'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid editing plan structure');
    });
  });

  describe('DELETE /api/preview/cache', () => {
    it('should clear cache successfully', async () => {
      const response = await request(app)
        .delete('/api/preview/cache')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cleared');
    });
  });
});
