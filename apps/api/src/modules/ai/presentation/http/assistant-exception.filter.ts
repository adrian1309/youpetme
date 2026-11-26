import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { ErrorResponse } from '@youpetme/contracts';
import type { Response } from 'express';

import { AiProviderUnavailableError } from '../../domain/errors/ai-provider-unavailable.error';
import { AssistantRequestInvalidError } from './assistant.request';

/** English texts for developers only; the client shows its own copy (ADR-017). */
const MESSAGES: Record<string, string> = {
  REQUIRED: 'This field is required',
  INVALID_FORMAT: 'This field has an invalid value',
  INVALID_TYPE: 'This field has an invalid type',
  TOO_LONG: 'This field is too long',
};

/**
 * Assistant errors in the ADR-017 shape, without new codes: the client tells them apart by
 * status (400 invalid body, 503 Diango is not available now). 401 and 429 go to the global filter.
 */
@Catch(AssistantRequestInvalidError, AiProviderUnavailableError)
export class AssistantExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body: ErrorResponse =
      exception instanceof AssistantRequestInvalidError
        ? {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: exception.issues.map((issue) => ({
              ...issue,
              message: MESSAGES[issue.code] ?? 'This field is invalid',
            })),
          }
        : {
            statusCode: 503,
            error: 'Service Unavailable',
            message: 'The assistant is not available now',
          };
    response.status(body.statusCode).json(body);
  }
}
