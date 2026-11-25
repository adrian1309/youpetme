import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { ErrorResponse } from '@youpetme/contracts';
import type { Response } from 'express';

import {
  AdoptionAnimalNotFoundError,
  AdoptionRequestActiveError,
  AdoptionRequestNotFoundError,
  AdoptionValidationError,
  AnimalNotAvailableError,
  TransitionNotAllowedError,
} from '../../domain/errors/adoption-errors';

/** English texts for developers only; the client shows its own copy (ADR-017). */
const MESSAGES: Record<string, string> = {
  REQUIRED: 'This field is required',
  INVALID_FORMAT: 'This field has an invalid value',
  INVALID_TYPE: 'This field has an invalid type',
  TOO_LONG: 'This field is too long',
};

const conflict = (message: string, code?: ErrorResponse['code']): ErrorResponse => ({
  statusCode: 409,
  error: 'Conflict',
  message,
  ...(code ? { code } : {}),
});

/**
 * Adoption errors in the ADR-017 shape. Scoped to the adoptions controller; 401, 403 and
 * unexpected errors keep going to the global filter.
 */
@Catch(
  AdoptionValidationError,
  AdoptionAnimalNotFoundError,
  AdoptionRequestNotFoundError,
  AnimalNotAvailableError,
  AdoptionRequestActiveError,
  TransitionNotAllowedError,
)
export class AdoptionsExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = toBody(exception);
    response.status(body.statusCode).json(body);
  }
}

function toBody(exception: Error): ErrorResponse {
  if (exception instanceof AdoptionValidationError) {
    return {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: exception.issues.map((issue) => ({
        ...issue,
        message: MESSAGES[issue.code] ?? 'This field is invalid',
      })),
    };
  }
  if (exception instanceof AdoptionAnimalNotFoundError) {
    return { statusCode: 404, error: 'Not Found', message: 'Animal not found' };
  }
  if (exception instanceof AdoptionRequestNotFoundError) {
    return { statusCode: 404, error: 'Not Found', message: 'Adoption request not found' };
  }
  if (exception instanceof AnimalNotAvailableError) {
    return conflict('This animal is not available for adoption', 'ANIMAL_NOT_AVAILABLE');
  }
  if (exception instanceof AdoptionRequestActiveError) {
    return conflict(
      'You already have an active request for this animal',
      'ADOPTION_REQUEST_ACTIVE',
    );
  }
  return conflict('This action is not allowed for the request in its current status');
}
