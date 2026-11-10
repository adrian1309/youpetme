import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserSession } from '../../domain/entities/user-session.entity';
import { User } from '../../domain/entities/user.entity';
import { AccountNotAvailableError } from '../../domain/errors/account-not-available.error';
import { SessionNotRenewableError } from '../../domain/errors/session-not-renewable.error';
import type { SessionStatus, UserStatus } from '../../domain/value-objects/account-states';
import {
  FakeRefreshTokenHasher,
  FakeRefreshTokenVerifier,
  FixedClock,
  InMemoryAccounts,
  InMemoryEventPublisher,
  InMemorySessions,
  RotatingFakeTokenIssuer,
  TEST_IAM_CONFIG,
} from '../../testing/in-memory-iam';
import { RefreshSessionUseCase } from './refresh-session.use-case';

const now = new Date('2026-11-05T10:00:00.000Z');
const USER_ID = 'user-1';
const SESSION_ID = 'session-1';
const CURRENT_TOKEN = `refresh:${USER_ID}:${SESSION_ID}`;
const hasher = new FakeRefreshTokenHasher();

function setup({
  userStatus = 'ACTIVE' as UserStatus,
  sessionStatus = 'ACTIVE' as SessionStatus,
  expiresAt = new Date('2026-11-10T10:00:00.000Z'),
  createdAt = new Date('2026-11-01T10:00:00.000Z'),
  clock = now,
} = {}) {
  const accounts = new InMemoryAccounts();
  const sessions = new InMemorySessions();
  const events = new InMemoryEventPublisher();
  const verifier = new FakeRefreshTokenVerifier();
  const created = createdAt;
  const user = User.reconstitute({
    id: USER_ID,
    email: 'john@example.com',
    passwordHash: 'hashed(x)',
    role: 'USER',
    status: userStatus,
    termsAcceptedAt: created,
    termsVersion: '2026-01',
    createdAt: created,
    updatedAt: created,
  });
  const session = UserSession.reconstitute({
    id: SESSION_ID,
    userId: USER_ID,
    refreshTokenHash: hasher.hash(CURRENT_TOKEN),
    status: sessionStatus,
    expiresAt,
    createdAt: created,
    updatedAt: created,
  });
  accounts.accounts.push({
    user,
    profile: UserProfile.create({
      id: 'p-1',
      userId: USER_ID,
      firstName: 'John',
      lastName: 'Doe',
      now: created,
    }),
    session,
  });
  sessions.sessions.set(SESSION_ID, session);
  const useCase = new RefreshSessionUseCase(
    verifier,
    sessions,
    accounts,
    hasher,
    new RotatingFakeTokenIssuer(),
    new FixedClock(clock),
    TEST_IAM_CONFIG,
  );
  const stored = () => sessions.sessions.get(SESSION_ID)!;
  return { useCase, sessions, events, verifier, stored };
}

describe('RefreshSessionUseCase (US-IAM-002)', () => {
  describe('Scenario 5 — Given an active session and its current refresh token', () => {
    it('Then it issues a new access token and a new refresh token for the same session', async () => {
      const { useCase } = setup();

      const result = await useCase.execute({ refreshToken: CURRENT_TOKEN });

      expect(result.accessToken).toBe(`access:${USER_ID}:${SESSION_ID}`);
      expect(result.refreshToken).toMatch(new RegExp(`^refresh:${USER_ID}:${SESSION_ID}:\\d+$`));
      expect(result.refreshToken).not.toBe(CURRENT_TOKEN);
    });

    it('Then it rotates the stored hash and restarts the 7-day lifetime from now', async () => {
      const { useCase, stored } = setup();

      const result = await useCase.execute({ refreshToken: CURRENT_TOKEN });

      const expected = new Date(now.getTime() + TEST_IAM_CONFIG.refreshTokenTtlMs);
      expect(stored()).toMatchObject({
        status: 'ACTIVE',
        refreshTokenHash: hasher.hash(result.refreshToken),
        expiresAt: expected,
        updatedAt: now,
      });
      expect(result.refreshTokenExpiresAt).toEqual(expected);
    });

    it('Then it returns the user, so a reloaded page can show who is signed in', async () => {
      const { useCase } = setup();

      const result = await useCase.execute({ refreshToken: CURRENT_TOKEN });

      expect(result.user).toEqual({
        id: USER_ID,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'ACTIVE',
      });
    });

    it('Then the new refresh token can be used for the next renewal', async () => {
      const { useCase } = setup();

      const first = await useCase.execute({ refreshToken: CURRENT_TOKEN });
      const second = await useCase.execute({ refreshToken: first.refreshToken });

      expect(second.refreshToken).not.toBe(first.refreshToken);
    });

    it('Then no domain event is published (TS-IAM-002)', async () => {
      const { useCase, events } = setup();

      await useCase.execute({ refreshToken: CURRENT_TOKEN });

      expect(events.events).toEqual([]);
    });
  });

  describe('Scenario 6 — Given a session that cannot be renewed', () => {
    it.each([
      ['no refresh token', undefined],
      ['an empty refresh token', ''],
      ['a token with an invalid signature or shape', 'garbage'],
      ['a token for an unknown session', `refresh:${USER_ID}:unknown-session`],
      ['a token whose user does not own the session', `refresh:someone-else:${SESSION_ID}`],
    ])('Then %s is rejected', async (_case, refreshToken) => {
      const { useCase, stored } = setup();

      await expect(useCase.execute({ refreshToken })).rejects.toBeInstanceOf(
        SessionNotRenewableError,
      );
      expect(stored().status).toBe('ACTIVE');
    });

    it.each(['REVOKED', 'EXPIRED'] as const)(
      'Then a %s session is rejected and stays as it was',
      async (sessionStatus) => {
        const { useCase, stored } = setup({ sessionStatus });

        await expect(useCase.execute({ refreshToken: CURRENT_TOKEN })).rejects.toBeInstanceOf(
          SessionNotRenewableError,
        );
        expect(stored().status).toBe(sessionStatus);
      },
    );

    it('Then a session past its expiry is rejected and marked EXPIRED', async () => {
      const { useCase, stored } = setup({ expiresAt: now });

      await expect(useCase.execute({ refreshToken: CURRENT_TOKEN })).rejects.toBeInstanceOf(
        SessionNotRenewableError,
      );
      expect(stored()).toMatchObject({ status: 'EXPIRED', updatedAt: now });
    });

    it('Then a token whose own expiry has passed is rejected and its session marked EXPIRED', async () => {
      const { useCase, verifier, stored } = setup();
      verifier.expired.add(CURRENT_TOKEN);

      await expect(useCase.execute({ refreshToken: CURRENT_TOKEN })).rejects.toBeInstanceOf(
        SessionNotRenewableError,
      );
      expect(stored().status).toBe('EXPIRED');
    });

    it('Then reusing an already rotated token is rejected and revokes the session', async () => {
      const { useCase, stored } = setup();
      const renewed = await useCase.execute({ refreshToken: CURRENT_TOKEN });

      await expect(useCase.execute({ refreshToken: CURRENT_TOKEN })).rejects.toBeInstanceOf(
        SessionNotRenewableError,
      );

      expect(stored()).toMatchObject({ status: 'REVOKED', updatedAt: now });
      // Possible theft: the legitimate holder's newer token stops working as well.
      await expect(useCase.execute({ refreshToken: renewed.refreshToken })).rejects.toBeInstanceOf(
        SessionNotRenewableError,
      );
    });

    it('Then losing a concurrent rotation is treated as reuse and revokes the session', async () => {
      const { useCase, sessions, stored } = setup();
      jest.spyOn(sessions, 'rotate').mockResolvedValueOnce(false);

      await expect(useCase.execute({ refreshToken: CURRENT_TOKEN })).rejects.toBeInstanceOf(
        SessionNotRenewableError,
      );
      expect(stored().status).toBe('REVOKED');
    });
  });

  describe('Given an account that is no longer ACTIVE', () => {
    it('Then it is reported as not available and the session is left as it is', async () => {
      const { useCase, stored } = setup({ userStatus: 'SUSPENDED' });

      await expect(useCase.execute({ refreshToken: CURRENT_TOKEN })).rejects.toBeInstanceOf(
        AccountNotAvailableError,
      );
      expect(stored()).toMatchObject({
        status: 'ACTIVE',
        refreshTokenHash: hasher.hash(CURRENT_TOKEN),
      });
    });
  });

  describe('absolute session lifetime (SCRUM-54: 30 days from sign-in, 7-day window)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const signedIn = new Date('2026-10-01T10:00:00.000Z');
    const day = (n: number, ms = 0) => new Date(signedIn.getTime() + n * DAY + ms);
    // A stored expiry still in the future, so only the absolute cap can end the session.
    const future = day(60);

    it('far from the cap, a refresh extends the session by the 7-day window', async () => {
      const { useCase, stored } = setup({ createdAt: signedIn, clock: day(10), expiresAt: future });

      const result = await useCase.execute({ refreshToken: CURRENT_TOKEN });

      expect(result.refreshTokenExpiresAt).toEqual(day(17));
      expect(stored().expiresAt).toEqual(day(17));
    });

    it('with less than 7 days left, the new expiry stops at the cap', async () => {
      const { useCase, stored } = setup({ createdAt: signedIn, clock: day(26), expiresAt: future });

      const result = await useCase.execute({ refreshToken: CURRENT_TOKEN });

      expect(result.refreshTokenExpiresAt).toEqual(day(30));
      expect(stored()).toMatchObject({ status: 'ACTIVE', expiresAt: day(30) });
    });

    it('just before the cap, it still renews, up to the cap', async () => {
      const { useCase } = setup({ createdAt: signedIn, clock: day(30, -1), expiresAt: future });

      const result = await useCase.execute({ refreshToken: CURRENT_TOKEN });

      expect(result.refreshTokenExpiresAt).toEqual(day(30));
    });

    it.each([
      ['exactly at the cap', day(30)],
      ['just after the cap', day(30, 1)],
      ['long after the cap (a session from before the cap existed)', day(40)],
    ])('%s, it is rejected and the session is marked EXPIRED', async (_case, clock) => {
      const { useCase, stored } = setup({ createdAt: signedIn, clock, expiresAt: future });

      await expect(useCase.execute({ refreshToken: CURRENT_TOKEN })).rejects.toBeInstanceOf(
        SessionNotRenewableError,
      );
      expect(stored()).toMatchObject({ status: 'EXPIRED', updatedAt: clock });
    });
  });
});
