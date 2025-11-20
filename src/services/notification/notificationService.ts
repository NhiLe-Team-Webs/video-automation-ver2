import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('NotificationService');

export interface NotificationMessage {
  type: 'completion' | 'error' | 'status';
  jobId: string;
  youtubeUrl?: string;
  message: string;
}

export interface OperatorAlert {
  severity: 'error' | 'warning' | 'info';
  jobId: string;
  stage: string;
  message: string;
  timestamp: Date;
}

export class NotificationService {
  private telegramBot?: TelegramBot;
  private telegramChatId?: string;

  constructor() {
    // Initialize Telegram bot if configured
    if (config.notifications.telegram?.botToken) {
      this.telegramBot = new TelegramBot(config.notifications.telegram.botToken, { polling: false });
      this.telegramChatId = config.notifications.telegram.chatId;
      logger.info('Telegram notification service initialized');
    }
  }

  /**
   * Send notification to user about job completion or error
   */
  async notifyUser(userId: string, message: NotificationMessage): Promise<void> {
    const method = config.notifications.method;

    try {
      switch (method) {
        case 'telegram':
          await this.sendTelegramNotification(message);
          break;
        case 'webhook':
          await this.sendWebhookNotification(message);
          break;
        case 'email':
          await this.sendEmailNotification(userId, message);
          break;
        case 'sms':
          await this.sendSmsNotification(userId, message);
          break;
        default:
          logger.warn(`Unknown notification method: ${method}`);
      }

      logger.info('User notification sent', {
        userId,
        jobId: message.jobId,
        type: message.type,
        method,
      });
    } catch (error) {
      logger.error('Failed to send user notification', {
        userId,
        jobId: message.jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Retry once after 2 seconds
      await this.delay(2000);
      try {
        await this.sendNotificationByMethod(method, userId, message);
        logger.info('User notification sent on retry', { userId, jobId: message.jobId });
      } catch (retryError) {
        logger.error('Failed to send user notification on retry', {
          userId,
          jobId: message.jobId,
          error: retryError instanceof Error ? retryError.message : String(retryError),
        });
        throw retryError;
      }
    }
  }

  /**
   * Send alert to system operator about processing errors
   */
  async notifyOperator(alert: OperatorAlert): Promise<void> {
    try {
      const operatorMessage = this.formatOperatorAlert(alert);

      // Send to Telegram if configured
      if (this.telegramBot && this.telegramChatId) {
        await this.telegramBot.sendMessage(this.telegramChatId, operatorMessage, {
          parse_mode: 'Markdown',
        });
      }

      // Send to webhook if configured
      if (config.notifications.endpoint) {
        await axios.post(config.notifications.endpoint, {
          type: 'operator_alert',
          alert,
          message: operatorMessage,
        });
      }

      // Send email to operator if configured
      if (config.notifications.operatorEmail) {
        await this.sendEmailNotification(config.notifications.operatorEmail, {
          type: 'error',
          jobId: alert.jobId,
          message: operatorMessage,
        });
      }

      logger.info('Operator alert sent', {
        jobId: alert.jobId,
        severity: alert.severity,
        stage: alert.stage,
      });
    } catch (error) {
      logger.error('Failed to send operator alert', {
        jobId: alert.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send notification via Telegram
   */
  private async sendTelegramNotification(message: NotificationMessage): Promise<void> {
    if (!this.telegramBot || !this.telegramChatId) {
      throw new Error('Telegram bot not configured');
    }

    const formattedMessage = this.formatTelegramMessage(message);
    await this.telegramBot.sendMessage(this.telegramChatId, formattedMessage, {
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    });
  }

  /**
   * Format message for Telegram
   */
  private formatTelegramMessage(message: NotificationMessage): string {
    const emoji = this.getEmojiForType(message.type);
    let text = `${emoji} *${this.getTypeLabel(message.type)}*\n\n`;
    text += `📋 Job ID: \`${message.jobId}\`\n`;
    text += `💬 ${message.message}\n`;

    if (message.youtubeUrl) {
      text += `\n🎬 [Xem video trên YouTube](${message.youtubeUrl})`;
    }

    return text;
  }

  /**
   * Format operator alert message
   */
  private formatOperatorAlert(alert: OperatorAlert): string {
    const emoji = alert.severity === 'error' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    let text = `${emoji} *Operator Alert: ${alert.severity.toUpperCase()}*\n\n`;
    text += `📋 Job ID: \`${alert.jobId}\`\n`;
    text += `🔧 Stage: ${alert.stage}\n`;
    text += `💬 ${alert.message}\n`;
    text += `⏰ ${alert.timestamp.toISOString()}`;
    return text;
  }

  /**
   * Send notification via webhook
   */
  private async sendWebhookNotification(message: NotificationMessage): Promise<void> {
    if (!config.notifications.endpoint) {
      throw new Error('Webhook endpoint not configured');
    }

    await axios.post(config.notifications.endpoint, {
      type: 'user_notification',
      message,
    });
  }

  /**
   * Send notification via email (placeholder)
   */
  private async sendEmailNotification(email: string, message: NotificationMessage): Promise<void> {
    // TODO: Implement email notification using a service like SendGrid, AWS SES, etc.
    logger.warn('Email notification not implemented', { email, jobId: message.jobId });
  }

  /**
   * Send notification via SMS (placeholder)
   */
  private async sendSmsNotification(userId: string, message: NotificationMessage): Promise<void> {
    // TODO: Implement SMS notification using a service like Twilio, AWS SNS, etc.
    logger.warn('SMS notification not implemented', { userId, jobId: message.jobId });
  }

  /**
   * Send notification by method (helper for retry)
   */
  private async sendNotificationByMethod(
    method: string,
    userId: string,
    message: NotificationMessage
  ): Promise<void> {
    switch (method) {
      case 'telegram':
        await this.sendTelegramNotification(message);
        break;
      case 'webhook':
        await this.sendWebhookNotification(message);
        break;
      case 'email':
        await this.sendEmailNotification(userId, message);
        break;
      case 'sms':
        await this.sendSmsNotification(userId, message);
        break;
    }
  }

  /**
   * Get emoji for message type
   */
  private getEmojiForType(type: string): string {
    switch (type) {
      case 'completion':
        return '✅';
      case 'error':
        return '❌';
      case 'status':
        return '📊';
      default:
        return '📢';
    }
  }

  /**
   * Get label for message type
   */
  private getTypeLabel(type: string): string {
    switch (type) {
      case 'completion':
        return 'Video Processing Complete';
      case 'error':
        return 'Processing Error';
      case 'status':
        return 'Status Update';
      default:
        return 'Notification';
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
