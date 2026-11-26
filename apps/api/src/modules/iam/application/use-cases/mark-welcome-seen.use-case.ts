import type { UserRepository } from '../../domain/ports/user-repository';

/**
 * SCRUM-17: a signed-in user closed Diango's welcome, so it is not shown again (ADR-011).
 * Idempotent: marking it twice changes nothing.
 */
export class MarkWelcomeSeenUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<void> {
    await this.users.markWelcomeSeen(userId);
  }
}
