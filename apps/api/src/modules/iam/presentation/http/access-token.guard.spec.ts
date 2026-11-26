import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from '../../domain/ports/access-token-verifier';
import {
  AccessTokenGuard,
  authenticatedUserOf,
  OptionalAccessTokenGuard,
  optionalAuthenticatedUserOf,
} from './access-token.guard';

const verified: VerifiedAccessToken = { userId: 'user-1', sessionId: 'session-1', role: 'USER' };

class FakeVerifier implements AccessTokenVerifier {
  readonly seen: string[] = [];
  verify(accessToken: string): Promise<VerifiedAccessToken | null> {
    this.seen.push(accessToken);
    return Promise.resolve(accessToken === 'valid-token' ? verified : null);
  }
}

function contextWith(authorization?: string) {
  const request = { headers: authorization === undefined ? {} : { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AccessTokenGuard (ADR-002: stateless access token, L3)', () => {
  it('lets a valid Bearer token through and exposes who it authenticates', async () => {
    const verifier = new FakeVerifier();
    const { context, request } = contextWith('Bearer valid-token');

    await expect(new AccessTokenGuard(verifier).canActivate(context)).resolves.toBe(true);

    expect(verifier.seen).toEqual(['valid-token']);
    expect(authenticatedUserOf(request)).toEqual(verified);
  });

  it('accepts the scheme in any case, as HTTP allows', async () => {
    const { context } = contextWith('bearer valid-token');

    await expect(new AccessTokenGuard(new FakeVerifier()).canActivate(context)).resolves.toBe(true);
  });

  it.each([
    ['no Authorization header', undefined],
    ['an empty header', ''],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['a Bearer without token', 'Bearer '],
    ['an invalid or expired token', 'Bearer not-valid'],
  ])('rejects %s with 401', async (_case, header) => {
    const { context, request } = contextWith(header);

    await expect(
      new AccessTokenGuard(new FakeVerifier()).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(() => authenticatedUserOf(request)).toThrow();
  });
});

describe('OptionalAccessTokenGuard (visitors allowed, e.g. Diango)', () => {
  it('lets a request without Authorization through as a visitor', async () => {
    const { context, request } = contextWith(undefined);

    await expect(
      new OptionalAccessTokenGuard(new FakeVerifier()).canActivate(context),
    ).resolves.toBe(true);
    expect(optionalAuthenticatedUserOf(request)).toBeNull();
  });

  it('exposes the user of a valid Bearer token', async () => {
    const { context, request } = contextWith('Bearer valid-token');

    await new OptionalAccessTokenGuard(new FakeVerifier()).canActivate(context);

    expect(optionalAuthenticatedUserOf(request)).toEqual(verified);
  });

  it('rejects a token that is sent but invalid or expired with 401, so the client can renew it', async () => {
    const { context } = contextWith('Bearer not-valid');

    await expect(
      new OptionalAccessTokenGuard(new FakeVerifier()).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
