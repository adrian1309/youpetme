import {
  clearMatchingProfile,
  MATCHING_PROFILE_KEY,
  readMatchingProfile,
  writeMatchingProfile,
} from './matching-profile';

describe('matching profile in localStorage (SCRUM-16, guest)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('writes, reads and clears a profile', () => {
    writeMatchingProfile({ preferredSpecies: 'DOG', hasChildren: true });

    expect(window.localStorage.getItem(MATCHING_PROFILE_KEY)).toBe(
      '{"preferredSpecies":"DOG","hasChildren":true}',
    );
    expect(readMatchingProfile()).toEqual({ preferredSpecies: 'DOG', hasChildren: true });

    clearMatchingProfile();
    expect(readMatchingProfile()).toBeNull();
  });

  it.each([
    ['nothing stored', null],
    ['invalid JSON', '{nope'],
    ['a value outside the enums', '{"housingSize":"HUGE"}'],
    ['free text in an unknown key', '{"notes":"hola"}'],
    ['an empty profile (nothing to offer)', '{}'],
  ])('reads null for %s', (_case, stored) => {
    if (stored !== null) window.localStorage.setItem(MATCHING_PROFILE_KEY, stored);

    expect(readMatchingProfile()).toBeNull();
  });
});
