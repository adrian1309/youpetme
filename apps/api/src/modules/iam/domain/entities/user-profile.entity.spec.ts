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
});
