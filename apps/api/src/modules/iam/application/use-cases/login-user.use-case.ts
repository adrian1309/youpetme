import { UserSession } from '../../domain/entities/user-session.entity';
import { AccountNotAvailableError } from '../../domain/errors/account-not-available.error';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import {
  ValidationFailedError,
  type ValidationIssue,
} from '../../domain/errors/validation-failed.error';
import { UserLoggedIn } from '../../domain/events/user-logged-in.event';
import type { Clock } from '../../domain/ports/clock';
import type { EventPublisher } from '../../domain/ports/event-publisher';
import type { IamConfig } from '../../domain/ports/iam-config';
import type { IdGenerator } from '../../domain/ports/id-generator';
import type { PasswordHasher } from '../../domain/ports/password-hasher';
import type { RefreshTokenHasher } from '../../domain/ports/refresh-token-hasher';
import type { TokenIssuer } from '../../domain/ports/token-issuer';
import type { UserRepository } from '../../domain/ports/user-repository';
import type { UserSessionRepository } from '../../domain/ports/user-session-repository';
import { Email } from '../../domain/value-objects/email';
import type { LoginUserCommand } from '../commands/login-user.command';
import type { AuthenticatedSessionResult } from '../dto/authenticated-session.result';

/** TS-IAM-002: signs an existing user in, opening a new session (one per login, ADR-002). */
export class LoginUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: UserSessionRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    private readonly tokenIssuer: TokenIssuer,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly config: IamConfig,
  ) {}

  async execute(command: LoginUserCommand): Promise<AuthenticatedSessionResult> {
    this.assertValid(command);

    const account = await this.users.findAccountByEmail(Email.create(command.email).value);
    // Verify even when there is no account, so the response time does not reveal whether the
    // email is registered; both failures then end in the same error.
    const passwordMatches = await this.passwordHasher.verify(
      account?.user.passwordHash ?? null,
      command.password,
    );
    if (!account || !passwordMatches) {
      throw new InvalidCredentialsError();
    }
    // Checked only after the password, so the account status is never disclosed without it.
    if (!account.user.canSignIn()) {
      throw new AccountNotAvailableError();
    }

    const { user } = account;
    const now = this.clock.now();
    const sessionId = this.ids.next();
    const refreshToken = await this.tokenIssuer.issueRefreshToken({ userId: user.id, sessionId });
    const accessToken = await this.tokenIssuer.issueAccessToken({
      userId: user.id,
      sessionId,
      role: user.role,
    });
    const expiresAt = new Date(now.getTime() + this.config.refreshTokenTtlMs);
    await this.sessions.create(
      UserSession.create({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.refreshTokenHasher.hash(refreshToken),
        now,
        expiresAt,
      }),
    );

    // ADR-016: only once the session is stored.
    await this.events.publish(new UserLoggedIn(user.id, now, command.correlationId));

    return {
      user: {
        id: user.id,
        firstName: account.firstName,
        lastName: account.lastName,
        email: user.email,
        status: user.status,
      },
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  /** Presence and email format only: the password policy applies to registration, not login. */
  private assertValid(command: LoginUserCommand): void {
    const issues: ValidationIssue[] = [...Email.validate(command.email)];
    if (command.password.length === 0) {
      issues.push({ field: 'password', code: 'REQUIRED' });
    }
    if (issues.length > 0) {
      throw new ValidationFailedError(issues);
    }
  }
}
