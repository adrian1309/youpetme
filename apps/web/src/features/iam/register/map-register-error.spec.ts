import type { ErrorResponse } from '@youpetme/contracts';

import { ApiError, NetworkError } from '../../../lib/http/api-error';
import { mapRegisterError } from './map-register-error';

function apiError(status: number, body?: Partial<ErrorResponse>): ApiError {
  return new ApiError(status, body as ErrorResponse | undefined);
}

describe('mapRegisterError (API errors to accessible, translated messages)', () => {
  describe('409 — BDD 2: email already registered', () => {
    it('puts the "in use" message on the email field and says nothing else about the account', () => {
      const result = mapRegisterError(
        apiError(409, {
          statusCode: 409,
          error: 'Conflict',
          message: 'This email is already in use',
        }),
      );

      expect(result).toEqual({ fieldErrors: { email: 'register.errors.emailInUse' } });
    });
  });

  describe('400 with details', () => {
    it('maps each field and code to the same keys the client schema uses', () => {
      const result = mapRegisterError(
        apiError(400, {
          details: [
            { field: 'firstName', code: 'TOO_LONG', message: 'x' },
            { field: 'lastName', code: 'REQUIRED', message: 'x' },
            { field: 'email', code: 'INVALID_FORMAT', message: 'x' },
            { field: 'password', code: 'TOO_SHORT', message: 'x' },
            { field: 'confirmPassword', code: 'MISMATCH', message: 'x' },
            { field: 'termsAccepted', code: 'MUST_BE_TRUE', message: 'x' },
          ],
        }),
      );

      expect(result).toEqual({
        fieldErrors: {
          firstName: 'register.errors.firstName.tooLong',
          lastName: 'register.errors.lastName.required',
          email: 'register.errors.email.invalid',
          password: 'register.errors.password.tooShort',
          confirmPassword: 'register.errors.confirmPassword.mismatch',
          termsAccepted: 'register.errors.terms.required',
        },
      });
    });

    it('maps the email length limit', () => {
      const result = mapRegisterError(
        apiError(400, { details: [{ field: 'email', code: 'TOO_LONG', message: 'x' }] }),
      );

      expect(result.fieldErrors.email).toBe('register.errors.email.tooLong');
    });

    it('keeps the first message when a field has several issues', () => {
      const result = mapRegisterError(
        apiError(400, {
          details: [
            { field: 'email', code: 'REQUIRED', message: 'x' },
            { field: 'email', code: 'INVALID_FORMAT', message: 'x' },
          ],
        }),
      );

      expect(result.fieldErrors.email).toBe('register.errors.email.required');
    });

    it('falls back to a general message when no detail can be placed on a field', () => {
      for (const details of [
        [{ field: 'body', code: 'INVALID_TYPE', message: 'x' }],
        [{ field: 'somethingNew', code: 'TOO_LONG', message: 'x' }],
        [{ field: 'email', code: 'UNKNOWN_CODE', message: 'x' }],
        [],
      ]) {
        expect(mapRegisterError(apiError(400, { details }))).toEqual({
          fieldErrors: {},
          formError: 'register.errors.reviewFields',
        });
      }
    });

    it('also falls back when the 400 has no details at all', () => {
      expect(mapRegisterError(apiError(400))).toEqual({
        fieldErrors: {},
        formError: 'register.errors.reviewFields',
      });
    });
  });

  describe('request rejected before reaching the form logic', () => {
    it.each([403, 415])('shows a general "request rejected" message for %i', (status) => {
      expect(mapRegisterError(apiError(status))).toEqual({
        fieldErrors: {},
        formError: 'register.errors.requestRejected',
      });
    });
  });

  describe('server and network failures', () => {
    it.each([500, 502, 503])('shows a general server message for %i', (status) => {
      expect(mapRegisterError(apiError(status))).toEqual({
        fieldErrors: {},
        formError: 'register.errors.server',
      });
    });

    it('shows a connection message when the request could not be made', () => {
      expect(mapRegisterError(new NetworkError())).toEqual({
        fieldErrors: {},
        formError: 'register.errors.network',
      });
    });

    it.each([401, 404, 418])('uses the generic message for an unexpected %i', (status) => {
      expect(mapRegisterError(apiError(status))).toEqual({
        fieldErrors: {},
        formError: 'register.errors.generic',
      });
    });

    it('uses the generic message for anything that is not an API or network error', () => {
      expect(mapRegisterError(new Error('boom'))).toEqual({
        fieldErrors: {},
        formError: 'register.errors.generic',
      });
      expect(mapRegisterError('oops')).toEqual({
        fieldErrors: {},
        formError: 'register.errors.generic',
      });
    });
  });

  it('never exposes the server message, only translation keys', () => {
    const result = mapRegisterError(
      apiError(400, {
        message: 'Validation failed',
        details: [{ field: 'password', code: 'TOO_SHORT', message: 'Password must be at least 8' }],
      }),
    );

    expect(JSON.stringify(result)).not.toContain('Validation failed');
    expect(JSON.stringify(result)).not.toContain('Password must be');
  });
});
