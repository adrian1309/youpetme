import { readRefreshTokenCookie } from './refresh-token-cookie';

describe('readRefreshTokenCookie', () => {
  it('reads the refresh_token value from a Cookie header', () => {
    expect(readRefreshTokenCookie('refresh_token=abc.def.ghi')).toBe('abc.def.ghi');
    expect(readRefreshTokenCookie('theme=dark; refresh_token=abc.def; lang=es')).toBe('abc.def');
  });

  it('returns undefined when there is no header, no such cookie or an empty value', () => {
    expect(readRefreshTokenCookie(undefined)).toBeUndefined();
    expect(readRefreshTokenCookie('')).toBeUndefined();
    expect(readRefreshTokenCookie('theme=dark')).toBeUndefined();
    expect(readRefreshTokenCookie('refresh_token=')).toBeUndefined();
    expect(readRefreshTokenCookie('other_refresh_token=abc')).toBeUndefined();
  });

  it('takes the first one when the cookie is repeated (the most specific path comes first)', () => {
    expect(readRefreshTokenCookie('refresh_token=first; refresh_token=second')).toBe('first');
  });

  it('decodes a percent-encoded value and ignores one that cannot be decoded', () => {
    expect(readRefreshTokenCookie('refresh_token=a%2Eb')).toBe('a.b');
    expect(readRefreshTokenCookie('refresh_token=%E0%A4%A')).toBeUndefined();
  });
});
