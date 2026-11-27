import type { AdopterProfile } from '../../domain/matching/adopter-profile';
import type { MatchingPreferencesWriter } from '../../domain/ports/matching-preferences-writer';

/**
 * SCRUM-16, scenario 3: a guest who used AI Matching registers and accepts saving the profile
 * kept in the browser. Replaces any previous one.
 */
export class SaveMatchingPreferencesUseCase {
  constructor(private readonly preferences: MatchingPreferencesWriter) {}

  async execute(userId: string, profile: AdopterProfile): Promise<void> {
    await this.preferences.save(userId, profile);
  }
}
