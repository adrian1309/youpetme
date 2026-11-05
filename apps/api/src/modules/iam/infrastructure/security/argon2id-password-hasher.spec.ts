import * as argon2 from 'argon2';

import { Argon2idPasswordHasher } from './argon2id-password-hasher';

// Pass-through spy: real Argon2, but the tests can see which hash each verification used.
jest.mock('argon2', () => {
  const actual = jest.requireActual<typeof import('argon2')>('argon2');
  return { ...actual, verify: jest.fn(actual.verify) };
});

describe('Argon2idPasswordHasher (ADR-002)', () => {
  const hasher = new Argon2idPasswordHasher();

  it('produces an Argon2id hash with the ADR-002 parameters, never the plain password', async () => {
    const hash = await hasher.hash('my-secure-passphrase');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(hash).not.toContain('my-secure-passphrase');
  });

  it('can be verified with the original password only', async () => {
    const hash = await hasher.hash('my-secure-passphrase');

    await expect(argon2.verify(hash, 'my-secure-passphrase')).resolves.toBe(true);
    await expect(argon2.verify(hash, 'another-passphrase')).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([hasher.hash('same-password'), hasher.hash('same-password')]);

    expect(a).not.toBe(b);
  });

  describe('verify', () => {
    it('accepts the original password and rejects any other', async () => {
      const hash = await hasher.hash('my-secure-passphrase');

      await expect(hasher.verify(hash, 'my-secure-passphrase')).resolves.toBe(true);
      await expect(hasher.verify(hash, 'another-passphrase')).resolves.toBe(false);
    });

    it('without a stored hash it still runs a full Argon2id verification and resolves false', async () => {
      const verifySpy = jest.mocked(argon2.verify);
      verifySpy.mockClear();

      await expect(hasher.verify(null, 'my-secure-passphrase')).resolves.toBe(false);

      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy.mock.calls[0]![0]).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    });

    it('treats a malformed stored hash as a mismatch instead of failing', async () => {
      await expect(hasher.verify('not-a-hash', 'my-secure-passphrase')).resolves.toBe(false);
    });
  });
});
