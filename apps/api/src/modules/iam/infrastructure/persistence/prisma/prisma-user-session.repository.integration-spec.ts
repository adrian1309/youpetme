import { UserSession } from '../../../domain/entities/user-session.entity';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../../platform/database/testing/test-database';
import { buildAccount } from '../../../testing/build-account';
import { PrismaAccountRegistrationRepository } from './prisma-account-registration.repository';
import { PrismaUserSessionRepository } from './prisma-user-session.repository';

describe('PrismaUserSessionRepository (PostgreSQL)', () => {
  let db: TestDatabase;
  let sessions: PrismaUserSessionRepository;
  let userId: string;
  const created = new Date('2026-11-01T10:00:00.000Z');
  const later = new Date('2026-11-05T10:00:00.000Z');

  function newSession(id = '11111111-1111-4111-8111-111111111111'): UserSession {
    return UserSession.create({
      id,
      userId,
      refreshTokenHash: 'a'.repeat(64),
      now: created,
      expiresAt: new Date('2026-11-08T10:00:00.000Z'),
    });
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    sessions = new PrismaUserSessionRepository(db.prisma);
  });

  beforeEach(async () => {
    await db.reset();
    const account = buildAccount();
    await new PrismaAccountRegistrationRepository(db.prisma).register(account);
    userId = account.user.id;
  });

  afterAll(async () => {
    await db.stop();
  });

  it('creates a session and finds it again by id', async () => {
    const session = newSession();

    await sessions.create(session);

    await expect(sessions.findById(session.id)).resolves.toEqual(session);
  });

  it('returns null for an unknown session', async () => {
    await expect(sessions.findById('00000000-0000-4000-8000-000000000000')).resolves.toBeNull();
  });

  describe('rotate (compare-and-set)', () => {
    it('stores the new hash and expiry when the expected hash is still current', async () => {
      const session = newSession();
      await sessions.create(session);
      const rotated = session.rotate('b'.repeat(64), later, new Date('2026-11-12T10:00:00.000Z'));

      await expect(sessions.rotate(rotated, session.refreshTokenHash)).resolves.toBe(true);

      await expect(sessions.findById(session.id)).resolves.toEqual(rotated);
    });

    it('lets only one of two concurrent rotations of the same token win', async () => {
      const session = newSession();
      await sessions.create(session);
      const expiry = new Date('2026-11-12T10:00:00.000Z');

      const results = await Promise.all([
        sessions.rotate(session.rotate('b'.repeat(64), later, expiry), session.refreshTokenHash),
        sessions.rotate(session.rotate('c'.repeat(64), later, expiry), session.refreshTokenHash),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('does not rotate a session that is no longer ACTIVE', async () => {
      const session = newSession();
      await sessions.create(session);
      await sessions.end(session.revoke(later));

      await expect(
        sessions.rotate(session.rotate('b'.repeat(64), later, later), session.refreshTokenHash),
      ).resolves.toBe(false);
      await expect(sessions.findById(session.id)).resolves.toMatchObject({
        status: 'REVOKED',
        refreshTokenHash: session.refreshTokenHash,
      });
    });
  });

  describe('end', () => {
    it.each(['REVOKED', 'EXPIRED'] as const)('persists the %s transition', async (status) => {
      const session = newSession();
      await sessions.create(session);
      const ended = status === 'REVOKED' ? session.revoke(later) : session.expire(later);

      await sessions.end(ended);

      await expect(sessions.findById(session.id)).resolves.toMatchObject({
        status,
        refreshTokenHash: session.refreshTokenHash,
      });
    });

    it('never reopens or changes a session that already ended', async () => {
      const session = newSession();
      await sessions.create(session);
      await sessions.end(session.revoke(later));

      await sessions.end(session.expire(later));

      await expect(sessions.findById(session.id)).resolves.toMatchObject({ status: 'REVOKED' });
    });

    it('only touches the given session', async () => {
      const first = newSession();
      const second = newSession('22222222-2222-4222-8222-222222222222');
      await sessions.create(first);
      await sessions.create(second);

      await sessions.end(first.revoke(later));

      await expect(sessions.findById(second.id)).resolves.toMatchObject({ status: 'ACTIVE' });
    });
  });
});
