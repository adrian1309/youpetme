import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { ErrorResponse } from '@youpetme/contracts';
import type { Response } from 'express';

import { AnimalNotFoundError } from '../../domain/errors/animal-not-found.error';
import { AnimalValidationError } from '../../domain/errors/animal-validation.error';

/** English texts for developers only; the client shows its own copy (ADR-017). */
const MESSAGES: Record<string, string> = {
  REQUIRED: 'This field is required',
  INVALID_FORMAT: 'This field has an invalid value',
  INVALID_TYPE: 'This field has an invalid type',
  TOO_LONG: 'This field is too long',
};

/**
 * Animals errors in the ADR-017 shape. Scoped to the animals controller; every other error
 * (401, 403, unexpected) keeps going to the global filter.
 */
@Catch(AnimalValidationError, AnimalNotFoundError)
export class AnimalsExceptionFilter implements ExceptionFilter {
  catch(exception: AnimalValidationError | AnimalNotFoundError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body: ErrorResponse =
      exception instanceof AnimalValidationError
        ? {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: exception.issues.map((issue) => ({
              ...issue,
              message: MESSAGES[issue.code] ?? 'This field is invalid',
            })),
          }
        : { statusCode: 404, error: 'Not Found', message: 'Animal not found' };
    response.status(body.statusCode).json(body);
  }
}
