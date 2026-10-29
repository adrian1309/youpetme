import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@youpetme/contracts';

import { PasswordPolicy } from './password-policy';

describe('PasswordPolicy vs. published contract', () => {
  it('stays in sync with the bounds clients mirror (ADR-002: server is the source of truth)', () => {
    expect(PasswordPolicy.MIN_LENGTH).toBe(PASSWORD_MIN_LENGTH);
    expect(PasswordPolicy.MAX_LENGTH).toBe(PASSWORD_MAX_LENGTH);
  });
});
