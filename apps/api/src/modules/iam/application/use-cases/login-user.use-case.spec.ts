import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserSession } from '../../domain/entities/user-session.entity';
import { User } from '../../domain/entities/user.entity';
import { AccountNotAvailableError } from '../../domain/errors/account-not-available.error';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { ValidationFailedError } from '../../domain/errors/validation-failed.error';
import { UserLoggedIn } from '../../domain/events/user-logged-in.event';
import type { UserStatus } from '../../domain/value-objects/account-states';
import {
  CallLog,
  FakePasswordHasher,
  FakeRefreshTokenHasher,
  FakeTokenIssuer,
  FixedClock,
  InMemoryAccounts,
  InMemoryEventPublisher,
  InMemorySessions,
  SequentialIdGenerator,
  TEST_IAM_CONFIG,
} from '../../testing/in-memory-iam';
import { LoginUserUseCase } from './login-user.use-case';

const now = new Date('2026-11-05T10:00:00.000Z');
const PASSWORD = 'my-secure-passphrase';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function setup({ status = 'ACTIVE' as UserStatus } = {}) {
  const log = new CallLog();
  const accounts = new InMemoryAccounts(log);
  const sessions = new InMemorySessions(log);
  const events = new InMemoryEventPublisher(log);
  const passwordHasher = new FakePasswordHasher();
  const created = new Date('2026-10-01T10:00:00.000Z');
  const user = User.reconstitute({
    id: USER_ID,
    email: 'john@example.com',
    passwordHash: `hashed(${PASSWORD})`,
    role: 'USER',
    status,
    termsAcceptedAt: created,
    termsVersion: '2026-01',
    createdAt: created,
    updatedAt: created,
  });
  accounts.accounts.push({
    user,
    profile: UserProfile.create({
      id: 'p-1',
      userId: user.id,
      firstName: 'John',
      lastName: 'Doe',
      now: created,
    }),
    session: UserSession.create({
      id: 'registration-session',
      userId: user.id,
      refreshTokenHash: 'registration-hash',
      now: created,
      expiresAt: new Date('2026-10-08T10:00:00.000Z'),
    }),
  });
  const useCase = new LoginUserUseCase(
    accounts,
    sessions,
    passwordHasher,
    new FakeRefreshTokenHasher(),
    new FakeTokenIssuer(),
    events,
    new FixedClock(now),
    new SequentialIdGenerator(),
    TEST_IAM_CONFIG,
  );
  return { useCase, sessions, events, passwordHasher, log };
}

describe('LoginUserUseCase (US-IAM-002)', () => {
  describe('Scenario 1 — Given an ACTIVE account, When the right email and password are sent', () => {
    it('Then it creates an ACTIVE UserSession bound to the new refresh token', async () => {
      const { useCase, sessions } = setup();

      const result = await useCase.execute({ email: 'john@example.com', password: PASSWORD });

      expect(sessions.sessions.size).toBe(1);
      const [session] = [...sessions.sessions.values()];
      expect(session).toMatchObject({
        userId: USER_ID,
        status: 'ACTIVE',
        refreshTokenHash: `digest(${result.refreshToken})`,
        createdAt: now,
        expiresAt: new Date(now.getTime() + TEST_IAM_CONFIG.refreshTokenTtlMs),
      });
      expect(result.refreshTokenExpiresAt).toEqual(session!.expiresAt);
    });

    it('Then it returns the user and tokens bound to that session', async () => {
      const { useCase, sessions } = setup();

      const result = await useCase.execute({ email: 'john@example.com', password: PASSWORD });

      const [session] = [...sessions.sessions.values()];
      expect(result.user).toEqual({
        id: USER_ID,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'ACTIVE',
      });
      expect(result.accessToken).toBe(`access:${USER_ID}:${session!.id}`);
      expect(result.refreshToken).toBe(`refresh:${USER_ID}:${session!.id}`);
    });

    it('Then it normalizes the email before looking the account up', async () => {
      const { useCase } = setup();

      await expect(
        useCase.execute({ email: '  John@Example.COM ', password: PASSWORD }),
      ).resolves.toMatchObject({ user: { id: USER_ID } });
    });

    it('Then it publishes UserLoggedIn, without sensitive data, after the session is stored', async () => {
      const { useCase, events, log } = setup();

      await useCase.execute({
        email: 'john@example.com',
        password: PASSWORD,
        correlationId: 'corr-1',
      });

      expect(events.events).toEqual([new UserLoggedIn(USER_ID, now, 'corr-1')]);
      expect(log.entries).toEqual(['createSession', 'publish']);
      expect(JSON.stringify(events.events)).not.toMatch(/password|hash|token|@/i);
    });
  });

  describe('Scenario 2 — Given wrong credentials', () => {
    it('Then an unknown email and a wrong password fail with the same error', async () => {
      const { useCase } = setup();

      const unknownEmail = await useCase
        .execute({ email: 'nobody@example.com', password: PASSWORD })
        .catch((e: unknown) => e);
      const wrongPassword = await useCase
        .execute({ email: 'john@example.com', password: 'not-the-password' })
        .catch((e: unknown) => e);

      expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError);
      expect(wrongPassword).toBeInstanceOf(InvalidCredentialsError);
      expect(unknownEmail).toEqual(wrongPassword);
    });

    it('Then an unknown email still runs a password verification, so both paths take as long', async () => {
      const { useCase, passwordHasher } = setup();

      await useCase.execute({ email: 'nobody@example.com', password: PASSWORD }).catch(() => {});

      expect(passwordHasher.verified).toEqual([null]);
    });

    it('Then no session is created and no event is published', async () => {
      const { useCase, sessions, events } = setup();

      await useCase.execute({ email: 'john@example.com', password: 'wrong' }).catch(() => {});

      expect(sessions.sessions.size).toBe(0);
      expect(events.events).toEqual([]);
    });
  });

  describe('Scenario 3 — Given an account that is not ACTIVE', () => {
    it.each(['SUSPENDED', 'DELETED'] as const)(
      'Then a %s account with the right password is reported as not available',
      async (status) => {
        const { useCase, sessions, events } = setup({ status });

        await expect(
          useCase.execute({ email: 'john@example.com', password: PASSWORD }),
        ).rejects.toBeInstanceOf(AccountNotAvailableError);
        expect(sessions.sessions.size).toBe(0);
        expect(events.events).toEqual([]);
      },
    );

    it('Then with a wrong password it is just invalid credentials, so the status is not revealed', async () => {
      const { useCase } = setup({ status: 'SUSPENDED' });

      await expect(
        useCase.execute({ email: 'john@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
  });

  describe('Scenario 4 — Given a user already signed in on another device', () => {
    it('Then a new login creates a second session and leaves the first one untouched', async () => {
      const { useCase, sessions } = setup();

      const first = await useCase.execute({ email: 'john@example.com', password: PASSWORD });
      const firstSession = [...sessions.sessions.values()][0]!;
      const second = await useCase.execute({ email: 'john@example.com', password: PASSWORD });

      expect(sessions.sessions.size).toBe(2);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(sessions.sessions.get(firstSession.id)).toBe(firstSession);
    });
  });

  describe('Given missing or malformed input', () => {
    it('Then it reports every invalid field and checks no credentials', async () => {
      const { useCase, passwordHasher } = setup();

      const error = await useCase.execute({ email: '', password: '' }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationFailedError);
      expect((error as ValidationFailedError).issues).toEqual([
        { field: 'email', code: 'REQUIRED' },
        { field: 'password', code: 'REQUIRED' },
      ]);
      expect(passwordHasher.verified).toEqual([]);
    });

    it('Then a malformed email is a format error, not invalid credentials', async () => {
      const { useCase } = setup();

      const error = await useCase
        .execute({ email: 'not-an-email', password: PASSWORD })
        .catch((e: unknown) => e);

      expect((error as ValidationFailedError).issues).toEqual([
        { field: 'email', code: 'INVALID_FORMAT' },
      ]);
    });

    it('Then the password is not checked against the password policy', async () => {
      const { useCase } = setup();

      await expect(
        useCase.execute({ email: 'john@example.com', password: 'short' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
  });
});
