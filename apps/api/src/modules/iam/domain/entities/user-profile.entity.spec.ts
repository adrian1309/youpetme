import { ValidationFailedError } from '../errors/validation-failed.error';
import { UserProfile } from './user-profile.entity';

describe('UserProfile.create', () => {
  const now = new Date('2026-10-25T10:00:00.000Z');
  const base = { id: 'p-1', userId: 'u-1', firstName: ' John ', lastName: ' Doe ', now };

  it('trims names, defaults hasSeenWelcome to false and matchingPreferences to null', () => {
    const profile = UserProfile.create(base);

    expect(profile).toMatchObject({
      id: 'p-1',
      userId: 'u-1',
      firstName: 'John',
      lastName: 'Doe',
      hasSeenWelcome: false,
      matchingPreferences: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  it('keeps hasSeenWelcome = true when the client reported it', () => {
    expect(UserProfile.create({ ...base, hasSeenWelcome: true }).hasSeenWelcome).toBe(true);
  });

  it('reports REQUIRED for blank names', () => {
    expect(UserProfile.validateNames('  ', '')).toEqual([
      { field: 'firstName', code: 'REQUIRED' },
      { field: 'lastName', code: 'REQUIRED' },
    ]);
    expect(() => UserProfile.create({ ...base, firstName: '   ' })).toThrow(ValidationFailedError);
  });

  it('exposes the 100-character name limit', () => {
    expect(UserProfile.NAME_MAX_LENGTH).toBe(100);
  });

  it('accepts names of exactly 100 characters, counted after trimming', () => {
    const hundred = 'a'.repeat(100);

    expect(UserProfile.validateNames(` ${hundred} `, hundred)).toEqual([]);
    expect(UserProfile.create({ ...base, firstName: ` ${hundred} ` }).firstName).toBe(hundred);
  });

  it('rejects names longer than 100 characters as TOO_LONG', () => {
    const tooLong = 'a'.repeat(101);

    expect(UserProfile.validateNames(tooLong, 'Doe')).toEqual([
      { field: 'firstName', code: 'TOO_LONG' },
    ]);
    expect(UserProfile.validateNames('John', tooLong)).toEqual([
      { field: 'lastName', code: 'TOO_LONG' },
    ]);
    expect(() => UserProfile.create({ ...base, lastName: tooLong })).toThrow(ValidationFailedError);
  });

  it('counts characters, not UTF-16 units: 100 emoji fit, 101 do not', () => {
    expect(UserProfile.validateNames('😀'.repeat(100), 'Doe')).toEqual([]);
    expect(UserProfile.validateNames('😀'.repeat(101), 'Doe')).toEqual([
      { field: 'firstName', code: 'TOO_LONG' },
    ]);
  });
});
