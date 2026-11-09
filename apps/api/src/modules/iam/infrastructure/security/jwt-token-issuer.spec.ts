import { JwtService } from '@nestjs/jwt';

import { JwtTokenIssuer } from './jwt-token-issuer';

const options = {
  accessSecret: 'a'.repeat(32),
  refreshSecret: 'b'.repeat(32),
  accessTtlMs: 5 * 60 * 1000,
  refreshTtlMs: 2 * 24 * 60 * 60 * 1000,
};

describe('JwtTokenIssuer', () => {
  const issuer = new JwtTokenIssuer(options);
  const jwt = new JwtService();
  const claims = { userId: 'user-1', sessionId: 'session-1' };

  it('issues an HS256 access token with sub, sid and role, valid for the configured lifetime', async () => {
    const token = await issuer.issueAccessToken({ ...claims, role: 'USER' });

    const payload = await jwt.verifyAsync<{
      sub: string;
      sid: string;
      role: string;
      iat: number;
      exp: number;
    }>(token, { secret: options.accessSecret, algorithms: ['HS256'] });
    expect(payload).toMatchObject({ sub: 'user-1', sid: 'session-1', role: 'USER' });
    expect(payload.exp - payload.iat).toBe(options.accessTtlMs / 1000);
  });

  it('issues a refresh token with sub, sid and a unique jti, valid for the configured lifetime', async () => {
    const first = await issuer.issueRefreshToken(claims);
    const second = await issuer.issueRefreshToken(claims);

    const payload = await jwt.verifyAsync<{
      sub: string;
      sid: string;
      jti: string;
      iat: number;
      exp: number;
    }>(first, { secret: options.refreshSecret, algorithms: ['HS256'] });
    expect(payload).toMatchObject({ sub: 'user-1', sid: 'session-1' });
    expect(payload.exp - payload.iat).toBe(options.refreshTtlMs / 1000);
    expect(first).not.toBe(second);
    expect(jwt.decode<{ jti: string }>(second).jti).not.toBe(payload.jti);
  });

  it('signs each token type with its own secret', async () => {
    const access = await issuer.issueAccessToken({ ...claims, role: 'USER' });
    const refresh = await issuer.issueRefreshToken(claims);

    await expect(jwt.verifyAsync(access, { secret: options.refreshSecret })).rejects.toThrow();
    await expect(jwt.verifyAsync(refresh, { secret: options.accessSecret })).rejects.toThrow();
  });

  describe('verify (refresh tokens)', () => {
    it('returns the user and session of a valid refresh token', async () => {
      const token = await issuer.issueRefreshToken(claims);

      await expect(issuer.verify(token)).resolves.toEqual({
        userId: 'user-1',
        sessionId: 'session-1',
        expired: false,
      });
    });

    it('still reads the claims of an expired token, flagged as expired', async () => {
      const token = await jwt.signAsync(
        { sub: 'user-1', sid: 'session-1', jti: 'j', exp: Math.floor(Date.now() / 1000) - 60 },
        { secret: options.refreshSecret, algorithm: 'HS256' },
      );

      await expect(issuer.verify(token)).resolves.toEqual({
        userId: 'user-1',
        sessionId: 'session-1',
        expired: true,
      });
    });

    it.each([
      ['an access token', () => issuer.issueAccessToken({ ...claims, role: 'USER' })],
      [
        'a token signed with another secret',
        () => jwt.signAsync({ sub: 'u', sid: 's' }, { secret: 'c'.repeat(32) }),
      ],
      [
        'a token without a session id',
        () => jwt.signAsync({ sub: 'u' }, { secret: options.refreshSecret }),
      ],
      [
        'an unsigned token (alg none)',
        () => {
          const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
          return Promise.resolve(`${encode({ alg: 'none' })}.${encode({ sub: 'u', sid: 's' })}.`);
        },
      ],
      ['garbage', () => Promise.resolve('not-a-jwt')],
    ])('rejects %s', async (_case, makeToken) => {
      await expect(issuer.verify(await makeToken())).resolves.toBeNull();
    });
  });

  describe('verifyAccessToken', () => {
    it('returns the user, session and role of a valid access token', async () => {
      const token = await issuer.issueAccessToken({ ...claims, role: 'USER' });

      await expect(issuer.verifyAccessToken(token)).resolves.toEqual({
        userId: 'user-1',
        sessionId: 'session-1',
        role: 'USER',
      });
    });

    it.each([
      ['a refresh token', () => issuer.issueRefreshToken(claims)],
      [
        'an expired access token',
        () =>
          jwt.signAsync(
            { sub: 'u', sid: 's', role: 'USER', exp: Math.floor(Date.now() / 1000) - 60 },
            { secret: options.accessSecret, algorithm: 'HS256' },
          ),
      ],
      [
        'a token signed with another secret',
        () => jwt.signAsync({ sub: 'u', sid: 's', role: 'USER' }, { secret: 'c'.repeat(32) }),
      ],
      [
        'a token without a role',
        () => jwt.signAsync({ sub: 'u', sid: 's' }, { secret: options.accessSecret }),
      ],
      [
        'an unsigned token (alg none)',
        () => {
          const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
          return Promise.resolve(
            `${encode({ alg: 'none' })}.${encode({ sub: 'u', sid: 's', role: 'USER' })}.`,
          );
        },
      ],
      ['garbage', () => Promise.resolve('not-a-jwt')],
    ])('rejects %s', async (_case, makeToken) => {
      await expect(issuer.verifyAccessToken(await makeToken())).resolves.toBeNull();
    });
  });
});
