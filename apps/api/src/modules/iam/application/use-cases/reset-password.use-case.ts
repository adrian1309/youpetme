import { ResetTokenInvalidError } from '../../domain/errors/reset-token-invalid.error';
import {
  ValidationFailedError,
  type ValidationIssue,
} from '../../domain/errors/validation-failed.error';
import { PasswordReset } from '../../domain/events/password-reset.event';
import type { Clock } from '../../domain/ports/clock';
import type { EventPublisher } from '../../domain/ports/event-publisher';
import type { PasswordHasher } from '../../domain/ports/password-hasher';
import type { PasswordResetTokenRepository } from '../../domain/ports/password-reset-token-repository';
import type { ResetTokenHasher } from '../../domain/ports/reset-token-hasher';
import type { UserRepository } from '../../domain/ports/user-repository';
import { PasswordPolicy } from '../../domain/value-objects/password-policy';
import type { ResetPasswordCommand } from '../commands/reset-password.command';

/**
 * TS-IAM-004: sets a new password with a reset link. Consumes the link, supersedes any other
 * pending one and revokes every session of the user (ADR-002, Password Changes). The user is not
 * signed in: they log in again with the new password.
 */
export class ResetPasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly tokenHasher: ResetTokenHasher,
    private readonly passwordHasher: PasswordHasher,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    this.assertValid(command);

    const now = this.clock.now();
    const token = await this.resetTokens.findByHash(this.tokenHasher.hash(command.token));
    if (!token || token.status !== 'ACTIVE') {
      throw new ResetTokenInvalidError();
    }
    if (token.isExpiredAt(now)) {
      await this.resetTokens.expire(token.expire(now));
      throw new ResetTokenInvalidError();
    }
    const account = await this.users.findAccountById(token.userId);
    if (!account?.user.canSignIn()) {
      throw new ResetTokenInvalidError();
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    const completed = await this.resetTokens.completeReset({
      token: token.markUsed(now),
      passwordHash,
    });
    if (!completed) {
      // Another confirmation of the same link got there first.
      throw new ResetTokenInvalidError();
    }

    // ADR-016: only after the commit.
    await this.events.publish(new PasswordReset(token.userId, now));
  }

  /** Input first, so a typo is reported even on a link that no longer works. */
  private assertValid(command: ResetPasswordCommand): void {
    const issues: ValidationIssue[] = [
      ...(command.token.length === 0 ? [{ field: 'token', code: 'REQUIRED' }] : []),
      ...PasswordPolicy.validate(command.password),
      ...PasswordPolicy.validateConfirmation(command.password, command.confirmPassword),
    ];
    if (issues.length > 0) {
      throw new ValidationFailedError(issues);
    }
  }
}
