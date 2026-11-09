import { UserSession } from '../../domain/entities/user-session.entity';
import { SessionOwnershipMismatchError } from '../../domain/errors/session-ownership-mismatch.error';
import { SessionRevoked } from '../../domain/events/session-revoked.event';
import type { SessionStatus } from '../../domain/value-objects/account-states';
import {
  CallLog,
  FakeRefreshTokenHasher,
  FakeRefreshTokenVerifier,
  FixedClock,
  InMemoryEventPublisher,
  InMemorySessions,
} from '../../testing/in-memory-iam';
import { RevokeSessionUseCase } from './revoke-session.use-case';

const now = new Date('2026-11-09T10:00:00.000Z');
const created = new Date('2026-11-08T10:00:00.000Z');
const USER_ID = 'user-1';
const hasher = new FakeRefreshTokenHasher();

function session(id: string, userId = USER_ID, status: SessionStatus = 'ACTIVE') {
  return UserSession.reconstitute({
    id,
    userId,
    refreshTokenHash: hasher.hash(`refresh:${userId}:${id}`),
    status,
    expiresAt: new Date('2026-11-15T10:00:00.000Z'),
    createdAt: created,
    updatedAt: created,
  });
}

function setup(...stored: UserSession[]) {
  const log = new CallLog();
  const sessions = new InMemorySessions(log);
  const events = new InMemoryEventPublisher(log);
  const verifier = new FakeRefreshTokenVerifier();
  for (const s of stored) sessions.sessions.set(s.id, s);
  const useCase = new RevokeSessionUseCase(verifier, sessions, events, new FixedClock(now));
  return { useCase, sessions, events, verifier, log };
}

describe('RevokeSessionUseCase (US-IAM-003)', () => {
  describe('Scenario 1 — Given an authenticated user, When they log out', () => {
    it('Then the session of their refresh cookie is REVOKED', async () => {
      const { useCase, sessions } = setup(session('device-a'));

      await useCase.execute({ userId: USER_ID, refreshToken: `refresh:${USER_ID}:device-a` });

      expect(sessions.sessions.get('device-a')).toMatchObject({
        status: 'REVOKED',
        updatedAt: now,
      });
    });

    it('Then SessionRevoked is published after the revocation is stored, without secrets', async () => {
      const { useCase, events, log } = setup(session('device-a'));

      await useCase.execute({ userId: USER_ID, refreshToken: `refresh:${USER_ID}:device-a` });

      expect(events.events).toEqual([new SessionRevoked('device-a', USER_ID, now)]);
      expect(log.entries).toEqual(['endSession', 'publish']);
      expect(JSON.stringify(events.events)).not.toMatch(/refresh|hash|token/i);
    });
  });

  describe('Scenario 2 — Given sessions on two devices, When the user logs out on device A', () => {
    it('Then only the session of device A is revoked and device B stays ACTIVE', async () => {
      const deviceB = session('device-b');
      const { useCase, sessions } = setup(session('device-a'), deviceB);

      await useCase.execute({ userId: USER_ID, refreshToken: `refresh:${USER_ID}:device-a` });

      expect(sessions.sessions.get('device-a')?.status).toBe('REVOKED');
      expect(sessions.sessions.get('device-b')).toBe(deviceB);
    });
  });

  describe('Given nothing left to revoke (L2: logout is idempotent)', () => {
    it.each([
      ['no refresh cookie', undefined],
      ['an empty cookie', ''],
      ['a cookie that is not a valid token', 'garbage'],
      ['a token for an unknown session', `refresh:${USER_ID}:unknown`],
    ])(
      'Then %s ends without error, revoking and publishing nothing',
      async (_case, refreshToken) => {
        const active = session('device-a');
        const { useCase, sessions, events } = setup(active);

        await expect(useCase.execute({ userId: USER_ID, refreshToken })).resolves.toBeUndefined();

        expect(sessions.sessions.get('device-a')).toBe(active);
        expect(events.events).toEqual([]);
      },
    );

    it.each(['REVOKED', 'EXPIRED'] as const)(
      'Then a session that is already %s is left as it is and no event is published',
      async (status) => {
        const ended = session('device-a', USER_ID, status);
        const { useCase, sessions, events } = setup(ended);

        await useCase.execute({ userId: USER_ID, refreshToken: `refresh:${USER_ID}:device-a` });

        expect(sessions.sessions.get('device-a')).toBe(ended);
        expect(events.events).toEqual([]);
      },
    );

    it('Then a token whose own expiry has passed revokes nothing', async () => {
      const active = session('device-a');
      const { useCase, sessions, verifier, events } = setup(active);
      verifier.expired.add(`refresh:${USER_ID}:device-a`);

      await useCase.execute({ userId: USER_ID, refreshToken: `refresh:${USER_ID}:device-a` });

      expect(sessions.sessions.get('device-a')).toBe(active);
      expect(events.events).toEqual([]);
    });

    it('Then losing a race with another revocation publishes no second event', async () => {
      const { useCase, sessions, events } = setup(session('device-a'));
      jest.spyOn(sessions, 'end').mockResolvedValueOnce(false);

      await useCase.execute({ userId: USER_ID, refreshToken: `refresh:${USER_ID}:device-a` });

      expect(events.events).toEqual([]);
    });
  });

  describe('Given a cookie that belongs to another user (L1)', () => {
    it('Then it is rejected and no session is revoked', async () => {
      const others = session('device-x', 'user-2');
      const { useCase, sessions, events } = setup(others);

      await expect(
        useCase.execute({ userId: USER_ID, refreshToken: 'refresh:user-2:device-x' }),
      ).rejects.toBeInstanceOf(SessionOwnershipMismatchError);

      expect(sessions.sessions.get('device-x')).toBe(others);
      expect(events.events).toEqual([]);
    });

    it('Then a token claiming the user for a session of someone else is rejected too', async () => {
      const others = session('device-x', 'user-2');
      const { useCase, sessions } = setup(others);

      await expect(
        useCase.execute({ userId: USER_ID, refreshToken: `refresh:${USER_ID}:device-x` }),
      ).rejects.toBeInstanceOf(SessionOwnershipMismatchError);
      expect(sessions.sessions.get('device-x')).toBe(others);
    });

    it('Then a cookie of another session of the same user is revoked (the cookie decides, L1)', async () => {
      const { useCase, sessions } = setup(session('device-a'), session('device-b'));

      // The access token may come from any session of the user; the cookie names the one to close.
      await useCase.execute({ userId: USER_ID, refreshToken: `refresh:${USER_ID}:device-b` });

      expect(sessions.sessions.get('device-b')?.status).toBe('REVOKED');
      expect(sessions.sessions.get('device-a')?.status).toBe('ACTIVE');
    });
  });
});
