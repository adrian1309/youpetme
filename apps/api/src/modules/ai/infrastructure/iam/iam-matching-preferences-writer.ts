import type { UserRepository } from '../../../iam/domain/ports/user-repository';
import type { AdopterProfile } from '../../domain/matching/adopter-profile';
import type { MatchingPreferencesWriter } from '../../domain/ports/matching-preferences-writer';

/** Writes the adopter profile into the IAM profile (UserProfile.matchingPreferences). */
export class IamMatchingPreferencesWriter implements MatchingPreferencesWriter {
  constructor(private readonly users: UserRepository) {}

  async save(userId: string, profile: AdopterProfile): Promise<void> {
    await this.users.saveMatchingPreferences(userId, { ...profile });
  }
}
