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
import type { UserRepository } from '../domain/ports/user-repository';

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
  hash(plainPassword: string): Promise<string> {
    return Promise.resolve(`hashed(${plainPassword})`);
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
};
