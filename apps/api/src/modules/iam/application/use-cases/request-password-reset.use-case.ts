import type { EmailSender } from '../../../notifications/domain/ports/email-sender';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import type { BackgroundTasks } from '../../domain/ports/background-tasks';
import type { Clock } from '../../domain/ports/clock';
import type { IamConfig } from '../../domain/ports/iam-config';
import type { IdGenerator } from '../../domain/ports/id-generator';
import type { PasswordResetTokenRepository } from '../../domain/ports/password-reset-token-repository';
import type { ResetTokenGenerator } from '../../domain/ports/reset-token-generator';
import type { ResetTokenHasher } from '../../domain/ports/reset-token-hasher';
import type { UserRepository } from '../../domain/ports/user-repository';
import { Email } from '../../domain/value-objects/email';
import type { RequestPasswordResetCommand } from '../commands/request-password-reset.command';
import { buildPasswordResetEmail } from '../password-reset-email';

/**
 * TS-IAM-004: emails a single-use reset link to an ACTIVE account. Resolves the same way whether
 * or not the account exists, so neither the response nor its timing reveal registered emails:
 * the email is sent after the request through BackgroundTasks (a direct call to the
 * EmailSender port, not an event — ADR-016).
 */
export class RequestPasswordResetUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly tokenGenerator: ResetTokenGenerator,
    private readonly tokenHasher: ResetTokenHasher,
    private readonly emails: EmailSender,
    private readonly background: BackgroundTasks,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly config: IamConfig,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = Email.create(command.email);
    const account = await this.users.findAccountByEmail(email.value);
    if (!account?.user.canSignIn()) return;

    const { user } = account;
    const now = this.clock.now();
    // At most one email a minute per account: a cheap brake on mail-bombing someone's inbox.
    const latest = await this.resetTokens.latestIssuedAt(user.id);
    if (latest && now.getTime() - latest.getTime() < this.config.passwordResetCooldownMs) return;

    const plainToken = this.tokenGenerator.generate();
    const token = PasswordResetToken.issue({
      id: this.ids.next(),
      userId: user.id,
      tokenHash: this.tokenHasher.hash(plainToken),
      now,
      ttlMs: this.config.passwordResetTtlMs,
    });
    await this.resetTokens.issue(token);

    const link = `${this.config.resetPasswordUrl}?token=${encodeURIComponent(plainToken)}`;
    const message = {
      ...buildPasswordResetEmail({ to: user.email, link, ttlMs: this.config.passwordResetTtlMs }),
      idempotencyKey: token.id,
    };
    this.background.run('Password reset email', () => this.emails.send(message));
  }
}
