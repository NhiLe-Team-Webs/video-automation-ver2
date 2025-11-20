import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from './notificationService';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Mock dependencies
vi.mock('node-telegram-bot-api');
vi.mock('axios');
vi.mock('../../config', () => ({
  config: {
    notifications: {
      method: 'telegram',
      endpoint: 'https://example.com/webhook',
      operatorEmail: 'operator@example.com',
      telegram: {
        botToken: 'test-bot-token',
        chatId: 'test-chat-id',
      },
    },
  },
}));
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NotificationService', () => {
  let service: NotificationService;
  let mockSendMessage: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup Telegram mock
    mockSendMessage = vi.fn().mockResolvedValue({});
    (TelegramBot as any).mockImplementation(() => ({
      sendMessage: mockSendMessage,
    }));

    // Setup axios mock
    (axios.post as any) = vi.fn().mockResolvedValue({ data: {} });

    service = new NotificationService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('notifyUser', () => {
    it('should send Telegram notification for completion', async () => {
      const message = {
        type: 'completion' as const,
        jobId: 'test-job-123',
        youtubeUrl: 'https://www.youtube.com/watch?v=test123',
        message: 'Video processing complete',
      };

      await service.notifyUser('user-123', message);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('Video Processing Complete'),
        expect.objectContaining({
          parse_mode: 'Markdown',
        })
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('test-job-123'),
        expect.any(Object)
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('https://www.youtube.com/watch?v=test123'),
        expect.any(Object)
      );
    });

    it('should send Telegram notification for error', async () => {
      const message = {
        type: 'error' as const,
        jobId: 'test-job-456',
        message: 'Processing failed at rendering stage',
      };

      await service.notifyUser('user-456', message);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('Processing Error'),
        expect.any(Object)
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('test-job-456'),
        expect.any(Object)
      );
    });

    it('should retry once on failure', async () => {
      mockSendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({});

      const message = {
        type: 'status' as const,
        jobId: 'test-job-789',
        message: 'Processing in progress',
      };

      await service.notifyUser('user-789', message);

      // Should be called twice (initial + retry)
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it('should throw error after retry fails', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      const message = {
        type: 'completion' as const,
        jobId: 'test-job-fail',
        message: 'Test message',
      };

      await expect(service.notifyUser('user-fail', message)).rejects.toThrow();

      // Should be called twice (initial + retry)
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('notifyOperator', () => {
    it('should send operator alert via Telegram', async () => {
      const alert = {
        severity: 'error' as const,
        jobId: 'test-job-alert',
        stage: 'rendering',
        message: 'Rendering failed due to memory error',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      await service.notifyOperator(alert);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('Operator Alert'),
        expect.objectContaining({
          parse_mode: 'Markdown',
        })
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('test-job-alert'),
        expect.any(Object)
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('rendering'),
        expect.any(Object)
      );
    });

    it('should send operator alert via webhook', async () => {
      const alert = {
        severity: 'warning' as const,
        jobId: 'test-job-warning',
        stage: 'transcribing',
        message: 'Transcription took longer than expected',
        timestamp: new Date(),
      };

      await service.notifyOperator(alert);

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          type: 'operator_alert',
          alert,
        })
      );
    });

    it('should not throw error if notification fails', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));
      (axios.post as any).mockRejectedValue(new Error('Webhook error'));

      const alert = {
        severity: 'info' as const,
        jobId: 'test-job-info',
        stage: 'uploading',
        message: 'Upload in progress',
        timestamp: new Date(),
      };

      // Should not throw
      await expect(service.notifyOperator(alert)).resolves.toBeUndefined();
    });
  });

  describe('message formatting', () => {
    it('should include correct emoji for completion', async () => {
      const message = {
        type: 'completion' as const,
        jobId: 'test-job',
        message: 'Done',
      };

      await service.notifyUser('user', message);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('✅'),
        expect.any(Object)
      );
    });

    it('should include correct emoji for error', async () => {
      const message = {
        type: 'error' as const,
        jobId: 'test-job',
        message: 'Failed',
      };

      await service.notifyUser('user', message);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('❌'),
        expect.any(Object)
      );
    });

    it('should include correct emoji for status', async () => {
      const message = {
        type: 'status' as const,
        jobId: 'test-job',
        message: 'In progress',
      };

      await service.notifyUser('user', message);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('📊'),
        expect.any(Object)
      );
    });
  });
});
