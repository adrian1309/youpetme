import {
  ForbiddenException,
  UnsupportedMediaTypeException,
  type ExecutionContext,
} from '@nestjs/common';

import type { AppConfig } from '../configuration/app-config';
import { TrustedBrowserRequestGuard } from './trusted-browser-request.guard';

const WEB_ORIGIN = 'http://localhost:5173';

function run(headers: Record<string, string>): boolean {
  const guard = new TrustedBrowserRequestGuard({ webOrigin: WEB_ORIGIN } as AppConfig);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
  return guard.canActivate(context);
}

describe('TrustedBrowserRequestGuard (CSRF defence for endpoints that set or read the refresh cookie)', () => {
  describe('Origin', () => {
    it('lets a request without Origin through (curl, tests, non-browser clients)', () => {
      expect(run({ 'content-type': 'application/json' })).toBe(true);
    });

    it('lets the configured web origin through', () => {
      expect(run({ origin: WEB_ORIGIN, 'content-type': 'application/json' })).toBe(true);
    });

    it.each([
      'https://evil.example',
      'http://localhost:5174',
      'null',
      `${WEB_ORIGIN}.evil.example`,
    ])('rejects Origin %s with 403', (origin) => {
      expect(() => run({ origin, 'content-type': 'application/json' })).toThrow(ForbiddenException);
    });
  });

  describe('Content-Type', () => {
    it.each(['application/json', 'application/json; charset=utf-8', 'Application/JSON'])(
      'accepts %s',
      (contentType) => {
        expect(run({ 'content-type': contentType })).toBe(true);
      },
    );

    it('accepts a request that sends no Content-Type (no body, so it cannot be a browser form)', () => {
      expect(run({})).toBe(true);
    });

    it.each([
      'application/x-www-form-urlencoded',
      'multipart/form-data; boundary=x',
      'text/plain',
      'application/jsonp',
      'application/vnd.api+json',
    ])('rejects %s with 415', (contentType) => {
      expect(() => run({ 'content-type': contentType })).toThrow(UnsupportedMediaTypeException);
    });
  });

  it('checks Origin before Content-Type', () => {
    expect(() => run({ origin: 'https://evil.example', 'content-type': 'text/plain' })).toThrow(
      ForbiddenException,
    );
  });
});
