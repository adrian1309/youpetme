import * as argon2 from 'argon2';

import { Argon2idPasswordHasher } from './argon2id-password-hasher';

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
});
