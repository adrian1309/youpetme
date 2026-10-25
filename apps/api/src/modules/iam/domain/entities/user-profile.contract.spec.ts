import { NAME_MAX_LENGTH } from '@youpetme/contracts';

import { UserProfile } from './user-profile.entity';

describe('UserProfile vs. published contract', () => {
  it('stays in sync with the name limit clients mirror (server is the source of truth)', () => {
    expect(UserProfile.NAME_MAX_LENGTH).toBe(NAME_MAX_LENGTH);
  });
});
