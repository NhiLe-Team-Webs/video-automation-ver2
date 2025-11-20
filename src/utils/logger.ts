import winston from 'winston';
import { config } from '../config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogMetadata {
  jobId?: string;
  stage?: string;
  [key: string]: any;
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.server.env === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    logger.log(level, message, {
      context: this.context,
      ...metadata,
    });
  }

  error(message: string, metadata?: LogMetadata): void {
    this.log('error', message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log('warn', message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log('info', message, metadata);
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log('debug', message, metadata);
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}
