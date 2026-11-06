import type { ErrorResponse } from '@youpetme/contracts';

import { ApiError, NetworkError } from '../../../lib/http/api-error';
import { mapLoginError } from './map-login-error';

function apiError(status: number, body?: Partial<ErrorResponse>): ApiError {
  return new ApiError(status, body as ErrorResponse | undefined);
}

describe('mapLoginError (US-IAM-002)', () => {
  describe('Scenario 2 — wrong credentials', () => {
    it('shows one form-level message that does not point at either field', () => {
      const result = mapLoginError(
        apiError(401, {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        }),
      );

      expect(result).toEqual({
        fieldErrors: {},
        formError: 'login.errors.invalidCredentials',
      });
    });

    it('treats any 401 the same way', () => {
      expect(mapLoginError(apiError(401))).toEqual(
        mapLoginError(apiError(401, { code: 'INVALID_CREDENTIALS' })),
      );
    });
  });

  describe('Scenario 3 — account not available', () => {
    it('shows the "not available" message only for that error code', () => {
      expect(mapLoginError(apiError(403, { code: 'ACCOUNT_NOT_AVAILABLE' }))).toEqual({
        fieldErrors: {},
        formError: 'login.errors.accountNotAvailable',
      });
    });

    it('treats a 403 without that code (a rejected Origin) or a 415 as a rejected request', () => {
      for (const error of [apiError(403, { message: 'x' }), apiError(415)]) {
        expect(mapLoginError(error)).toEqual({
          fieldErrors: {},
          formError: 'login.errors.requestRejected',
        });
      }
    });
  });

  describe('400 with details', () => {
    it('maps the fields to the same keys the client schema uses', () => {
      expect(
        mapLoginError(
          apiError(400, {
            details: [
              { field: 'email', code: 'INVALID_FORMAT', message: 'x' },
              { field: 'password', code: 'REQUIRED', message: 'x' },
            ],
          }),
        ),
      ).toEqual({
        fieldErrors: {
          email: 'login.errors.email.invalid',
          password: 'login.errors.password.required',
        },
      });
    });

    it('falls back to a form message when no detail can be shown on a field', () => {
      expect(
        mapLoginError(apiError(400, { details: [{ field: 'x', code: 'Y', message: 'z' }] })),
      ).toEqual({
        fieldErrors: {},
        formError: 'login.errors.reviewFields',
      });
    });
  });

  it.each([
    ['a network error', new NetworkError(), 'login.errors.network'],
    ['a server error', apiError(503), 'login.errors.server'],
    ['anything else', new Error('boom'), 'login.errors.generic'],
  ])('maps %s to a generic form message', (_case, error, key) => {
    expect(mapLoginError(error)).toEqual({ fieldErrors: {}, formError: key });
  });
});
