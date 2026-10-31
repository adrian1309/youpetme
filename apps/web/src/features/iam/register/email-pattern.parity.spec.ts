import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { EMAIL_PATTERN } from './register.schema';

const apiEmailSource = readFileSync(
  resolve(__dirname, '../../../../../api/src/modules/iam/domain/value-objects/email.ts'),
  'utf8',
);

describe('email format parity with the API (the server is the source of truth)', () => {
  it('uses exactly the same pattern as the API Email value object', () => {
    const apiPattern = /const EMAIL_PATTERN = (\/.+\/);/.exec(apiEmailSource)?.[1];

    expect(apiPattern, 'EMAIL_PATTERN not found in apps/api email.ts').toBeDefined();
    expect(String(EMAIL_PATTERN)).toBe(apiPattern);
  });

  it('accepts and rejects the same representative addresses', () => {
    const valid = ['john@example.com', 'a.b+c@sub.example.co.uk', 'ñandú@ejemplo.es', 'x@y.zz'];
    const invalid = [
      '',
      'nope',
      'john@',
      '@example.com',
      'john@example',
      'a b@example.com',
      'a@b@c.com',
      'a@.com',
      'a@b..com',
    ];

    for (const address of valid) expect(EMAIL_PATTERN.test(address), address).toBe(true);
    for (const address of invalid) expect(EMAIL_PATTERN.test(address), address).toBe(false);
  });
});
