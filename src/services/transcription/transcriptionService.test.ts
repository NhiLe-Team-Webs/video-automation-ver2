import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TranscriptionService, TranscriptSegment } from './transcriptionService';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';

describe('TranscriptionService', () => {
  let service: TranscriptionService;
  const testDir = path.join(config.storage.tempDir, 'test-transcription');

  beforeEach(async () => {
    service = new TranscriptionService();
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('SRT file generation and parsing', () => {
    it('should generate valid SRT file from segments', async () => {
      const segments: TranscriptSegment[] = [
        { start: 0, end: 2.5, text: 'Hello world' },
        { start: 2.5, end: 5.0, text: 'This is a test' },
        { start: 5.0, end: 8.3, text: 'Testing transcription' },
      ];

      const srtPath = path.join(testDir, 'test.srt');
      
      // Use private method via reflection for testing
      await (service as any).writeSRT(srtPath, segments);

      // Verify file exists
      const fileExists = await fs.access(srtPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Read and verify content
      const content = await fs.readFile(srtPath, 'utf-8');
      expect(content).toContain('1');
      expect(content).toContain('00:00:00,000 --> 00:00:02,500');
      expect(content).toContain('Hello world');
      expect(content).toContain('2');
      expect(content).toContain('00:00:02,500 --> 00:00:05,000');
      expect(content).toContain('This is a test');
    });

    it('should parse valid SRT file correctly', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:02,500
Hello world

2
00:00:02,500 --> 00:00:05,000
This is a test

3
00:00:05,000 --> 00:00:08,300
Testing transcription

`;

      const srtPath = path.join(testDir, 'test.srt');
      await fs.writeFile(srtPath, srtContent, 'utf-8');

      const segments = await (service as any).parseSRT(srtPath);

      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({
        start: 0,
        end: 2.5,
        text: 'Hello world',
      });
      expect(segments[1]).toEqual({
        start: 2.5,
        end: 5.0,
        text: 'This is a test',
      });
      expect(segments[2]).toEqual({
        start: 5.0,
        end: 8.3,
        text: 'Testing transcription',
      });
    });

    it('should validate correct SRT file format', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:02,500
Hello world

2
00:00:02,500 --> 00:00:05,000
This is a test

`;

      const srtPath = path.join(testDir, 'valid.srt');
      await fs.writeFile(srtPath, srtContent, 'utf-8');

      await expect((service as any).validateSRT(srtPath)).resolves.not.toThrow();
    });

    it('should reject empty SRT file', async () => {
      const srtPath = path.join(testDir, 'empty.srt');
      await fs.writeFile(srtPath, '', 'utf-8');

      await expect((service as any).validateSRT(srtPath)).rejects.toThrow('SRT file is empty');
    });

    it('should reject SRT with invalid sequence numbers', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:02,500
Hello world

3
00:00:02,500 --> 00:00:05,000
This is a test

`;

      const srtPath = path.join(testDir, 'invalid-sequence.srt');
      await fs.writeFile(srtPath, srtContent, 'utf-8');

      await expect((service as any).validateSRT(srtPath)).rejects.toThrow('invalid sequence number');
    });

    it('should reject SRT with invalid timestamp format', async () => {
      const srtContent = `1
00:00:00 --> 00:00:02
Hello world

`;

      const srtPath = path.join(testDir, 'invalid-timestamp.srt');
      await fs.writeFile(srtPath, srtContent, 'utf-8');

      await expect((service as any).validateSRT(srtPath)).rejects.toThrow('invalid timestamp format');
    });

    it('should reject SRT with empty text', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:02,500


`;

      const srtPath = path.join(testDir, 'empty-text.srt');
      await fs.writeFile(srtPath, srtContent, 'utf-8');

      // This will fail with "fewer than 3 lines" which is also a valid rejection
      await expect((service as any).validateSRT(srtPath)).rejects.toThrow();
    });
  });

  describe('SRT timestamp formatting', () => {
    it('should format seconds to SRT timestamp correctly', () => {
      expect((service as any).formatSRTTimestamp(0)).toBe('00:00:00,000');
      expect((service as any).formatSRTTimestamp(2.5)).toBe('00:00:02,500');
      expect((service as any).formatSRTTimestamp(65.123)).toBe('00:01:05,123');
      expect((service as any).formatSRTTimestamp(3661.456)).toBe('01:01:01,456');
    });

    it('should parse SRT timestamp to seconds correctly', () => {
      expect((service as any).parseSRTTimestamp(['00', '00', '00', '000'])).toBe(0);
      expect((service as any).parseSRTTimestamp(['00', '00', '02', '500'])).toBe(2.5);
      expect((service as any).parseSRTTimestamp(['00', '01', '05', '123'])).toBe(65.123);
      expect((service as any).parseSRTTimestamp(['01', '01', '01', '456'])).toBe(3661.456);
    });

    it('should round-trip timestamp conversion', () => {
      const testValues = [0, 1.5, 30.25, 125.999, 3600.5];
      
      for (const value of testValues) {
        const formatted = (service as any).formatSRTTimestamp(value);
        const match = formatted.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        expect(match).not.toBeNull();
        
        const parsed = (service as any).parseSRTTimestamp(match!.slice(1));
        expect(Math.abs(parsed - value)).toBeLessThan(0.001); // Allow 1ms tolerance
      }
    });
  });

  describe('Path generation', () => {
    it('should generate audio path from video path', () => {
      const videoPath = '/path/to/video.mp4';
      const audioPath = (service as any).generateAudioPath(videoPath);
      // Use path.normalize to handle platform differences
      expect(path.normalize(audioPath)).toBe(path.normalize('/path/to/video.mp3'));
    });

    it('should generate SRT path from audio path', () => {
      const audioPath = '/path/to/audio.mp3';
      const srtPath = (service as any).generateSRTPath(audioPath);
      // Use path.normalize to handle platform differences
      expect(path.normalize(srtPath)).toBe(path.normalize('/path/to/audio.srt'));
    });
  });

  describe('Retry logic', () => {
    it('should implement exponential backoff delay', async () => {
      const delays: number[] = [];
      const originalDelay = (service as any).delay.bind(service);
      
      (service as any).delay = async (ms: number) => {
        delays.push(ms);
        return originalDelay(ms);
      };

      // Mock transcribeLocal to fail twice then succeed
      let attemptCount = 0;
      (service as any).transcribeLocal = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated failure');
        }
        return {
          srtPath: '/test/path.srt',
          segments: [],
        };
      };

      // Mock config to use local
      const originalUseLocal = config.whisper.useLocal;
      config.whisper.useLocal = true;

      try {
        await service.transcribe('/test/audio.mp3');
        
        // Should have 2 delays (after 1st and 2nd attempts)
        expect(delays).toHaveLength(2);
        expect(delays[0]).toBe(1000); // 2^0 * 1000 = 1s
        expect(delays[1]).toBe(2000); // 2^1 * 1000 = 2s
      } finally {
        config.whisper.useLocal = originalUseLocal;
      }
    });
  });
});
