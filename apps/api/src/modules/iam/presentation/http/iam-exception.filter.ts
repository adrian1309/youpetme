import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { ErrorDetail, ErrorResponse } from '@youpetme/contracts';
import type { Response } from 'express';

import { EmailAlreadyRegisteredError } from '../../domain/errors/email-already-registered.error';
import {
  ValidationFailedError,
  type ValidationIssue,
} from '../../domain/errors/validation-failed.error';

const MESSAGES: Record<string, string> = {
  REQUIRED: 'This field is required',
  INVALID_FORMAT: 'This field has an invalid format',
  INVALID_TYPE: 'This field has an invalid type',
  TOO_SHORT: 'Password must be at least 8 characters long',
  TOO_LONG: 'Password must be at most 128 characters long',
  MISMATCH: 'Passwords do not match',
  MUST_BE_TRUE: 'You must accept the Terms of Service and the Privacy Policy',
};

function toDetails(issues: readonly ValidationIssue[]): ErrorDetail[] {
  return issues.map((issue) => ({
    ...issue,
    message: MESSAGES[issue.code] ?? 'This field is invalid',
  }));
}

/** Translates domain errors into the stable error shape; unexpected errors stay generic. */
@Catch()
export class IamExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(IamExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    response.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ErrorResponse } {
    if (exception instanceof ValidationFailedError) {
      return {
        status: 400,
        body: {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          details: toDetails(exception.issues),
        },
      };
    }
    if (exception instanceof EmailAlreadyRegisteredError) {
      return {
        status: 409,
        body: { statusCode: 409, error: 'Conflict', message: 'This email is already in use' },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        body: {
          statusCode: status,
          error: exception.name,
          message: 'Request could not be processed',
        },
      };
    }
    // Log the error class only: messages may carry connection strings or user data.
    this.logger.error(
      `Unhandled error: ${exception instanceof Error ? exception.constructor.name : typeof exception}`,
    );
    return {
      status: 500,
      body: { statusCode: 500, error: 'Internal Server Error', message: 'Internal server error' },
    };
  }
}
