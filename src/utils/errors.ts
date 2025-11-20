export type PipelineStage =
  | 'uploaded'
  | 'auto-editing'
  | 'transcribing'
  | 'storing-transcript'
  | 'detecting-highlights'
  | 'generating-plan'
  | 'rendering'
  | 'uploading'
  | 'completed'
  | 'failed';

export interface ErrorContext {
  jobId: string;
  stage: PipelineStage;
  attemptNumber: number;
}

export interface ErrorResolution {
  action: 'retry' | 'fail' | 'skip';
  delay?: number;
  userMessage: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: ErrorContext
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 400, true, context);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ProcessingError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 500, true, context);
    Object.setPrototypeOf(this, ProcessingError.prototype);
  }
}

export class ExternalAPIError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 502, true, context);
    Object.setPrototypeOf(this, ExternalAPIError.prototype);
  }
}

export class StorageError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 500, true, context);
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class ErrorHandler {
  async handleError(error: Error, context: ErrorContext): Promise<ErrorResolution> {
    if (error instanceof ValidationError) {
      return {
        action: 'fail',
        userMessage: error.message,
      };
    }

    if (error instanceof ProcessingError) {
      return {
        action: 'fail',
        userMessage: `Processing failed at stage ${context.stage}: ${error.message}`,
      };
    }

    if (error instanceof ExternalAPIError) {
      if (context.attemptNumber < 3) {
        const delay = Math.pow(2, context.attemptNumber) * 1000;
        return {
          action: 'retry',
          delay,
          userMessage: `External API error, retrying in ${delay}ms`,
        };
      }
      return {
        action: 'fail',
        userMessage: `External API failed after 3 attempts: ${error.message}`,
      };
    }

    if (error instanceof StorageError) {
      if (context.attemptNumber < 3) {
        const delay = Math.pow(2, context.attemptNumber) * 1000;
        return {
          action: 'retry',
          delay,
          userMessage: `Storage error, retrying in ${delay}ms`,
        };
      }
      return {
        action: 'fail',
        userMessage: `Storage failed after 3 attempts: ${error.message}`,
      };
    }

    return {
      action: 'fail',
      userMessage: `Unexpected error: ${error.message}`,
    };
  }
}
