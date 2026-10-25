import { Sha256RefreshTokenHasher } from './sha256-refresh-token-hasher';

describe('Sha256RefreshTokenHasher', () => {
  const hasher = new Sha256RefreshTokenHasher();

  it('returns a deterministic 64-character hex digest', () => {
    expect(hasher.hash('token')).toBe(hasher.hash('token'));
    expect(hasher.hash('token')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not contain the token and differs per token', () => {
    expect(hasher.hash('token-a')).not.toContain('token-a');
    expect(hasher.hash('token-a')).not.toBe(hasher.hash('token-b'));
  });

  it('matches the well-known SHA-256 of "abc"', () => {
    expect(hasher.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
