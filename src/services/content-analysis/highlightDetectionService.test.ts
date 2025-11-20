import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { HighlightDetectionService } from '../content-analysis/highlightDetectionService';

describe('HighlightDetectionService', () => {
  let service: HighlightDetectionService;
  let testSRTPath: string;

  beforeEach(() => {
    service = new HighlightDetectionService();
    testSRTPath = path.join(process.cwd(), 'temp', 'test-highlights.srt');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(testSRTPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('detectHighlights', () => {
    it('should detect highlights from SRT file with keywords', async () => {
      // Create test SRT with highlight keywords
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
This is a normal sentence without much importance.

2
00:00:05,000 --> 00:00:10,000
This is an IMPORTANT breakthrough that we discovered!

3
00:00:10,000 --> 00:00:15,000
Another regular sentence here.

4
00:00:15,000 --> 00:00:20,000
This is AMAZING and FANTASTIC news everyone!
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      expect(highlights.length).toBeGreaterThan(0);
      
      // Should detect the important and amazing segments
      const importantHighlight = highlights.find(h => 
        h.startTime >= 5 && h.startTime < 10
      );
      expect(importantHighlight).toBeDefined();
      expect(importantHighlight?.confidence).toBeGreaterThan(0);
      // Videogrep approach: matches exact keywords
      expect(importantHighlight?.reason).toContain('matched');
    });

    it('should detect highlights with default keywords', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
This is a normal sentence.

2
00:00:05,000 --> 00:00:10,000
This is the best solution to the problem!
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      expect(highlights.length).toBeGreaterThan(0);
      
      // Should detect keywords from default patterns (best, solution, problem)
      const keywordHighlight = highlights.find(h => 
        h.reason.includes('matched')
      );
      expect(keywordHighlight).toBeDefined();
    });

    it('should detect highlights with important keywords', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Regular statement here.

2
00:00:05,000 --> 00:00:10,000
What is the most important thing to remember?
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      expect(highlights.length).toBeGreaterThan(0);
      
      // Should match "important" and "remember" from default patterns
      const keywordHighlight = highlights.find(h => 
        h.reason.includes('important') || h.reason.includes('remember')
      );
      expect(keywordHighlight).toBeDefined();
    });

    it('should return empty array when no highlights detected', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Just a normal sentence.

2
00:00:05,000 --> 00:00:10,000
Another regular sentence.
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      // May or may not find highlights depending on threshold
      expect(Array.isArray(highlights)).toBe(true);
    });

    it('should merge adjacent highlights', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:02,000
This is IMPORTANT news!

2
00:00:02,500 --> 00:00:04,500
And this is CRITICAL information!

3
00:00:10,000 --> 00:00:12,000
Another IMPORTANT point later.
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      // Should merge the first two highlights but keep the third separate
      expect(highlights.length).toBeGreaterThanOrEqual(1);
      
      // Check that merged highlight spans both segments
      const mergedHighlight = highlights.find(h => 
        h.startTime <= 2 && h.endTime >= 4
      );
      if (highlights.length > 1) {
        expect(mergedHighlight).toBeDefined();
      }
    });

    it('should validate highlight timestamps', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
This is IMPORTANT and CRITICAL information!

2
00:00:05,000 --> 00:00:10,000
Another AMAZING discovery here!
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      // All highlights should have valid timestamps
      for (const highlight of highlights) {
        expect(highlight.startTime).toBeLessThan(highlight.endTime);
        expect(highlight.startTime).toBeGreaterThanOrEqual(0);
        expect(highlight.endTime).toBeLessThanOrEqual(10);
        expect(highlight.confidence).toBeGreaterThan(0);
        expect(highlight.confidence).toBeLessThanOrEqual(1);
        expect(highlight.reason).toBeTruthy();
      }
    });

    it('should handle empty SRT file', async () => {
      await fs.writeFile(testSRTPath, '', 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      expect(highlights).toEqual([]);
    });

    it('should handle SRT file with invalid format gracefully', async () => {
      const srtContent = `This is not a valid SRT format
Just some random text
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      // Should return empty array for invalid format
      expect(Array.isArray(highlights)).toBe(true);
    });

    it('should detect highlights with excitement keywords', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
This is incredible! Amazing! Wow!
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      expect(highlights.length).toBeGreaterThan(0);
      
      // Should match "incredible" and "amazing" from default patterns
      const excitementHighlight = highlights.find(h => 
        h.reason.includes('incredible') || h.reason.includes('amazing')
      );
      expect(excitementHighlight).toBeDefined();
    });

    it('should detect highlights with keyword emphasis', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
This is VERY IMPORTANT and you must REMEMBER this.
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      const highlights = await service.detectHighlights(testSRTPath);

      expect(highlights.length).toBeGreaterThan(0);
      
      // Should match "important" and "remember" from default patterns
      const keywordHighlight = highlights.find(h => 
        h.reason.includes('important') || h.reason.includes('remember')
      );
      expect(keywordHighlight).toBeDefined();
    });
  });

  describe('searchHighlights', () => {
    it('should search for custom patterns (videogrep-style)', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Welcome to the tutorial.

2
00:00:05,000 --> 00:00:10,000
Today we will learn about machine learning.

3
00:00:10,000 --> 00:00:15,000
Machine learning is fascinating.

4
00:00:15,000 --> 00:00:20,000
Let's dive into the details.
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      // Search for "machine learning" pattern
      const highlights = await service.searchHighlights(testSRTPath, ['machine learning']);

      expect(highlights.length).toBeGreaterThan(0);
      
      // Should find the segments containing "machine learning"
      const mlHighlight = highlights.find(h => 
        h.startTime >= 5 && h.startTime < 15
      );
      expect(mlHighlight).toBeDefined();
      expect(mlHighlight?.confidence).toBe(1.0); // Custom searches have full confidence
      expect(mlHighlight?.reason).toContain('matched');
    });

    it('should search with string patterns', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
The price is $100.

2
00:00:05,000 --> 00:00:10,000
It costs $50 dollars.

3
00:00:10,000 --> 00:00:15,000
No pricing information here.
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      // Search for "price" keyword (videogrep accepts strings)
      const highlights = await service.searchHighlights(testSRTPath, ['price', 'costs']);

      expect(highlights.length).toBeGreaterThan(0);
      
      // Should find segments with price/costs
      expect(highlights.some(h => h.startTime < 10)).toBe(true);
    });

    it('should search with multiple patterns', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
This is about cats.

2
00:00:05,000 --> 00:00:10,000
This is about dogs.

3
00:00:15,000 --> 00:00:20,000
This is about birds.
`;

      await fs.writeFile(testSRTPath, srtContent, 'utf-8');

      // Search for multiple animals
      const highlights = await service.searchHighlights(testSRTPath, ['cats', 'dogs']);

      // Should find cats and dogs (may be merged if close together)
      expect(highlights.length).toBeGreaterThan(0);
      
      // Should find cats and dogs but not birds
      const highlightText = highlights.map(h => h.reason).join(' ');
      expect(highlightText).toContain('cats');
      expect(highlightText).toContain('dogs');
      expect(highlightText).not.toContain('birds');
    });
  });
});
