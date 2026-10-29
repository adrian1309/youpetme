import { ValidationFailedError } from '../errors/validation-failed.error';
import { Email } from './email';

describe('Email', () => {
  it('normalizes by trimming and lowercasing', () => {
    expect(Email.create('  John.Doe@Example.COM ').value).toBe('john.doe@example.com');
  });

  it.each(['', '   ', 'not-an-email', 'john@', '@example.com', 'john@example', 'a b@example.com'])(
    'rejects %p',
    (raw) => {
      expect(() => Email.create(raw)).toThrow(ValidationFailedError);
    },
  );

  it('reports REQUIRED for an empty value and INVALID_FORMAT for a malformed one', () => {
    expect(Email.validate('  ')).toEqual([{ field: 'email', code: 'REQUIRED' }]);
    expect(Email.validate('nope')).toEqual([{ field: 'email', code: 'INVALID_FORMAT' }]);
    expect(Email.validate('john@example.com')).toEqual([]);
  });

  it('rejects addresses longer than 254 characters as TOO_LONG and accepts exactly 254', () => {
    const tooLong = `${'a'.repeat(243)}@example.com`;
    expect(Email.validate(`${'a'.repeat(242)}@example.com`)).toEqual([]);
    expect(Email.validate(tooLong)).toEqual([{ field: 'email', code: 'TOO_LONG' }]);
  });
});
