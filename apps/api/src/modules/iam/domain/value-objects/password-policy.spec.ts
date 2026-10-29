import { PasswordPolicy } from './password-policy';

describe('PasswordPolicy (ADR-002)', () => {
  it('exposes the 8..128 bounds', () => {
    expect(PasswordPolicy.MIN_LENGTH).toBe(8);
    expect(PasswordPolicy.MAX_LENGTH).toBe(128);
  });

  it('rejects an empty password as REQUIRED', () => {
    expect(PasswordPolicy.validate('')).toEqual([{ field: 'password', code: 'REQUIRED' }]);
  });

  it('rejects 7 characters as TOO_SHORT and accepts exactly 8', () => {
    expect(PasswordPolicy.validate('a'.repeat(7))).toEqual([
      { field: 'password', code: 'TOO_SHORT' },
    ]);
    expect(PasswordPolicy.validate('a'.repeat(8))).toEqual([]);
  });

  it('accepts exactly 128 characters and rejects 129 as TOO_LONG', () => {
    expect(PasswordPolicy.validate('a'.repeat(128))).toEqual([]);
    expect(PasswordPolicy.validate('a'.repeat(129))).toEqual([
      { field: 'password', code: 'TOO_LONG' },
    ]);
  });

  it('enforces no complexity rules and keeps surrounding spaces', () => {
    expect(PasswordPolicy.validate('        ')).toEqual([]);
    expect(PasswordPolicy.validate('alllowercaseletters')).toEqual([]);
  });
});
