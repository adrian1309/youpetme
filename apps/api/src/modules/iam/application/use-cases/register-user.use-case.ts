import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserSession } from '../../domain/entities/user-session.entity';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyRegisteredError } from '../../domain/errors/email-already-registered.error';
import {
  ValidationFailedError,
  type ValidationIssue,
} from '../../domain/errors/validation-failed.error';
import { UserCreated } from '../../domain/events/user-created.event';
import type { AccountRegistrationRepository } from '../../domain/ports/account-registration-repository';
import type { Clock } from '../../domain/ports/clock';
import type { EventPublisher } from '../../domain/ports/event-publisher';
import type { IamConfig } from '../../domain/ports/iam-config';
import type { IdGenerator } from '../../domain/ports/id-generator';
import type { PasswordHasher } from '../../domain/ports/password-hasher';
import type { RefreshTokenHasher } from '../../domain/ports/refresh-token-hasher';
import type { TokenIssuer } from '../../domain/ports/token-issuer';
import type { UserRepository } from '../../domain/ports/user-repository';
import { Email } from '../../domain/value-objects/email';
import { PasswordPolicy } from '../../domain/value-objects/password-policy';
import type { RegisterUserCommand } from '../commands/register-user.command';
import type { RegisterUserResult } from '../dto/register-user.result';

/** TS-IAM-001: registers an account and leaves the visitor authenticated. */
export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly accounts: AccountRegistrationRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    private readonly tokenIssuer: TokenIssuer,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly config: IamConfig,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    this.assertValid(command);

    const email = Email.create(command.email);
    if (await this.users.existsByEmail(email.value)) {
      throw new EmailAlreadyRegisteredError();
    }

    const now = this.clock.now();
    const passwordHash = await this.passwordHasher.hash(command.password);

    const user = User.register({
      id: this.ids.next(),
      email,
      passwordHash,
      termsVersion: this.config.termsVersion,
      now,
    });
    const profile = UserProfile.create({
      id: this.ids.next(),
      userId: user.id,
      firstName: command.firstName,
      lastName: command.lastName,
      hasSeenWelcome: command.hasSeenWelcome,
      now,
    });

    // The session id goes into both tokens, and the refresh token digest must exist before the
    // single transaction that persists the three records.
    const sessionId = this.ids.next();
    const refreshToken = await this.tokenIssuer.issueRefreshToken({
      userId: user.id,
      sessionId,
    });
    const accessToken = await this.tokenIssuer.issueAccessToken({
      userId: user.id,
      sessionId,
      role: user.role,
    });
    const expiresAt = new Date(now.getTime() + this.config.refreshTokenTtlMs);
    const session = UserSession.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.refreshTokenHasher.hash(refreshToken),
      now,
      expiresAt,
    });

    await this.accounts.register({ user, profile, session });

    // ADR-016: only after the commit, so a rolled-back registration never emits the event.
    await this.events.publish(new UserCreated(user.id, user.email, now, command.correlationId));

    return {
      user: {
        id: user.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: user.email,
        status: user.status,
      },
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  private assertValid(command: RegisterUserCommand): void {
    const issues: ValidationIssue[] = [
      ...UserProfile.validateNames(command.firstName, command.lastName),
      ...Email.validate(command.email),
      ...PasswordPolicy.validate(command.password),
    ];

    if (command.confirmPassword.length === 0) {
      issues.push({ field: 'confirmPassword', code: 'REQUIRED' });
    } else if (command.confirmPassword !== command.password) {
      issues.push({ field: 'confirmPassword', code: 'MISMATCH' });
    }

    if (command.termsAccepted !== true) {
      issues.push({ field: 'termsAccepted', code: 'MUST_BE_TRUE' });
    }

    if (issues.length > 0) {
      throw new ValidationFailedError(issues);
    }
  }
}
