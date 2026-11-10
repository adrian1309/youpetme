import { EmailAlreadyRegisteredError } from '../domain/errors/email-already-registered.error';
import type { DomainEvent } from '../domain/events/user-created.event';
import type {
  AccountRegistrationRepository,
  NewAccount,
} from '../domain/ports/account-registration-repository';
import type { Clock } from '../domain/ports/clock';
import type { EventPublisher } from '../domain/ports/event-publisher';
import type { IamConfig } from '../domain/ports/iam-config';
import type { IdGenerator } from '../domain/ports/id-generator';
import type { PasswordHasher } from '../domain/ports/password-hasher';
import type { RefreshTokenHasher } from '../domain/ports/refresh-token-hasher';
import type { TokenIssuer } from '../domain/ports/token-issuer';
import type {
  RefreshTokenVerifier,
  VerifiedRefreshToken,
} from '../domain/ports/refresh-token-verifier';
import type { UserAccount, UserRepository } from '../domain/ports/user-repository';
import type { UserSessionRepository } from '../domain/ports/user-session-repository';
import type { UserSession } from '../domain/entities/user-session.entity';

/** Records the order of side effects so tests can assert "event after persistence". */
export class CallLog {
  readonly entries: string[] = [];
}

/** In-memory adapters for unit tests only (ARCH-002); excluded from production builds. */
export class InMemoryAccounts implements UserRepository, AccountRegistrationRepository {
  readonly accounts: NewAccount[] = [];
  failNextRegisterWith: Error | undefined;

  constructor(private readonly log: CallLog = new CallLog()) {}

  existsByEmail(normalizedEmail: string): Promise<boolean> {
    return Promise.resolve(this.accounts.some((a) => a.user.email === normalizedEmail));
  }

  findAccountByEmail(normalizedEmail: string): Promise<UserAccount | null> {
    return Promise.resolve(
      this.toAccount(this.accounts.find((a) => a.user.email === normalizedEmail)),
    );
  }

  findAccountById(userId: string): Promise<UserAccount | null> {
    return Promise.resolve(this.toAccount(this.accounts.find((a) => a.user.id === userId)));
  }

  private toAccount(account: NewAccount | undefined): UserAccount | null {
    if (!account) return null;
    return {
      user: account.user,
      firstName: account.profile.firstName,
      lastName: account.profile.lastName,
    };
  }

  register(account: NewAccount): Promise<void> {
    this.log.entries.push('register');
    if (this.failNextRegisterWith) {
      const error = this.failNextRegisterWith;
      this.failNextRegisterWith = undefined;
      return Promise.reject(error);
    }
    if (this.accounts.some((a) => a.user.email === account.user.email)) {
      return Promise.reject(new EmailAlreadyRegisteredError());
    }
    this.accounts.push(account);
    return Promise.resolve();
  }
}

export class InMemoryEventPublisher implements EventPublisher {
  readonly events: DomainEvent[] = [];

  constructor(private readonly log: CallLog = new CallLog()) {}

  publish(event: DomainEvent): Promise<void> {
    this.log.entries.push('publish');
    this.events.push(event);
    return Promise.resolve();
  }
}

export class FakePasswordHasher implements PasswordHasher {
  /** Every hash passed to verify, `null` included, so tests can see the dummy verification. */
  readonly verified: (string | null)[] = [];

  hash(plainPassword: string): Promise<string> {
    return Promise.resolve(`hashed(${plainPassword})`);
  }

  verify(passwordHash: string | null, plainPassword: string): Promise<boolean> {
    this.verified.push(passwordHash);
    return Promise.resolve(passwordHash !== null && passwordHash === `hashed(${plainPassword})`);
  }
}

export class FakeRefreshTokenHasher implements RefreshTokenHasher {
  hash(refreshToken: string): string {
    return `digest(${refreshToken})`;
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  issueAccessToken(claims: { userId: string; sessionId: string }): Promise<string> {
    return Promise.resolve(`access:${claims.userId}:${claims.sessionId}`);
  }

  issueRefreshToken(claims: { userId: string; sessionId: string }): Promise<string> {
    return Promise.resolve(`refresh:${claims.userId}:${claims.sessionId}`);
  }
}

/** Issues a different refresh token on every call, as the JWT adapter does (random jti). */
export class RotatingFakeTokenIssuer extends FakeTokenIssuer {
  private issued = 0;

  override issueRefreshToken(claims: { userId: string; sessionId: string }): Promise<string> {
    this.issued += 1;
    return Promise.resolve(`refresh:${claims.userId}:${claims.sessionId}:${this.issued}`);
  }
}

/** Accepts tokens shaped like FakeTokenIssuer's; tokens listed in `expired` verify as expired. */
export class FakeRefreshTokenVerifier implements RefreshTokenVerifier {
  readonly expired = new Set<string>();

  verify(refreshToken: string): Promise<VerifiedRefreshToken | null> {
    const match = /^refresh:([^:]+):([^:]+)(:\d+)?$/.exec(refreshToken);
    if (!match) return Promise.resolve(null);
    return Promise.resolve({
      userId: match[1]!,
      sessionId: match[2]!,
      expired: this.expired.has(refreshToken),
    });
  }
}

export class InMemorySessions implements UserSessionRepository {
  readonly sessions = new Map<string, UserSession>();

  constructor(private readonly log: CallLog = new CallLog()) {}

  create(session: UserSession): Promise<void> {
    this.log.entries.push('createSession');
    this.sessions.set(session.id, session);
    return Promise.resolve();
  }

  findById(sessionId: string): Promise<UserSession | null> {
    return Promise.resolve(this.sessions.get(sessionId) ?? null);
  }

  rotate(rotated: UserSession, expectedHash: string): Promise<boolean> {
    const stored = this.sessions.get(rotated.id);
    if (!stored || !stored.isActive() || !stored.matches(expectedHash)) {
      return Promise.resolve(false);
    }
    this.sessions.set(rotated.id, rotated);
    return Promise.resolve(true);
  }

  end(session: UserSession): Promise<boolean> {
    this.log.entries.push('endSession');
    const stored = this.sessions.get(session.id);
    if (!stored?.isActive()) return Promise.resolve(false);
    this.sessions.set(session.id, session);
    return Promise.resolve(true);
  }
}

export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return this.instant;
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

export const TEST_IAM_CONFIG: IamConfig = {
  termsVersion: '2026-01',
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
  sessionMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
};
