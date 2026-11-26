import type { UserRepository } from '../../../iam/domain/ports/user-repository';
import type {
  AssistantUserContext,
  AssistantUserContextReader,
} from '../../domain/ports/assistant-user-context';

/** Reads Diango's basic user context from the IAM profile (ADR-011, Option Y). */
export class IamAssistantUserContext implements AssistantUserContextReader {
  constructor(private readonly users: UserRepository) {}

  async find(userId: string): Promise<AssistantUserContext | null> {
    const account = await this.users.findAccountById(userId);
    if (!account || account.user.status !== 'ACTIVE') return null;
    return { firstName: account.firstName, matchingPreferences: account.matchingPreferences };
  }
}
