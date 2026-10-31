import { EMAIL_MAX_LENGTH } from '@youpetme/contracts';

import { Email } from './email';

describe('Email vs. published contract', () => {
  const addressOfLength = (length: number) =>
    `${'a'.repeat(length - '@example.com'.length)}@example.com`;

  it('stays in sync with the email limit clients mirror (server is the source of truth)', () => {
    expect(Email.validate(addressOfLength(EMAIL_MAX_LENGTH))).toEqual([]);
    expect(Email.validate(addressOfLength(EMAIL_MAX_LENGTH + 1))).toEqual([
      { field: 'email', code: 'TOO_LONG' },
    ]);
  });
});
