import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../../platform/database/testing/test-database';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity';
import { UserSession } from '../../../domain/entities/user-session.entity';
import { buildAccount } from '../../../testing/build-account';
import { PrismaAccountRegistrationRepository } from './prisma-account-registration.repository';
import { PrismaPasswordResetTokenRepository } from './prisma-password-reset-token.repository';
import { PrismaUserSessionRepository } from './prisma-user-session.repository';

describe('PrismaPasswordResetTokenRepository (PostgreSQL)', () => {
  let db: TestDatabase;
  let tokens: PrismaPasswordResetTokenRepository;
  let userId: string;
  let otherUserId: string;
  const issuedAt = new Date('2026-11-11T10:00:00.000Z');
  const later = new Date('2026-11-11T10:30:00.000Z');
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  let sequence = 0;

  function newToken(owner = userId, now = issuedAt): PasswordResetToken {
    sequence += 1;
    return PasswordResetToken.issue({
      id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
      userId: owner,
      tokenHash: String(sequence).padStart(64, '0'),
      now,
      ttlMs: TWO_HOURS,
    });
  }

  async function statusOf(id: string): Promise<string | undefined> {
    return (await db.prisma.passwordResetToken.findUnique({ where: { id } }))?.status;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    tokens = new PrismaPasswordResetTokenRepository(db.prisma);
  });

  beforeEach(async () => {
    await db.reset();
    const registration = new PrismaAccountRegistrationRepository(db.prisma);
    const account = buildAccount();
    const other = buildAccount();
    await registration.register(account);
    await registration.register(other);
    userId = account.user.id;
    otherUserId = other.user.id;
  });

  afterAll(async () => {
    await db.stop();
  });

  it('issues a token and finds it again by its hash', async () => {
    const token = newToken();

    await tokens.issue(token);

    await expect(tokens.findByHash(token.tokenHash)).resolves.toEqual(token);
  });

  it('returns null for an unknown hash', async () => {
    await expect(tokens.findByHash('f'.repeat(64))).resolves.toBeNull();
  });

  it('refuses two tokens with the same hash', async () => {
    const token = newToken();
    await tokens.issue(token);

    await expect(
      db.prisma.passwordResetToken.create({
        data: { ...token, id: '99999999-9999-4999-8999-999999999999' },
      }),
    ).rejects.toThrow();
  });

  it('supersedes the previous ACTIVE token of the same user only', async () => {
    const first = newToken();
    const othersToken = newToken(otherUserId);
    await tokens.issue(first);
    await tokens.issue(othersToken);

    const second = newToken(userId, later);
    await tokens.issue(second);

    expect(await statusOf(first.id)).toBe('SUPERSEDED');
    expect(await statusOf(second.id)).toBe('ACTIVE');
    expect(await statusOf(othersToken.id)).toBe('ACTIVE');
  });

  it('tells when the user last requested a link', async () => {
    await expect(tokens.latestIssuedAt(userId)).resolves.toBeNull();

    await tokens.issue(newToken());
    await tokens.issue(newToken(userId, later));

    await expect(tokens.latestIssuedAt(userId)).resolves.toEqual(later);
  });

  it('marks an ACTIVE token EXPIRED, but never a token that already left ACTIVE', async () => {
    const token = newToken();
    await tokens.issue(token);

    await tokens.expire(token.expire(later));
    expect(await statusOf(token.id)).toBe('EXPIRED');

    const used = newToken();
    await tokens.issue(used);
    await db.prisma.passwordResetToken.update({ where: { id: used.id }, data: { status: 'USED' } });
    await tokens.expire(used.expire(later));
    expect(await statusOf(used.id)).toBe('USED');
  });

  describe('completeReset (one transaction)', () => {
    it('consumes the token, stores the new password and revokes every ACTIVE session', async () => {
      const sessions = new PrismaUserSessionRepository(db.prisma);
      await sessions.create(
        UserSession.create({
          id: '22222222-2222-4222-8222-222222222222',
          userId,
          refreshTokenHash: 'c'.repeat(64),
          now: issuedAt,
          expiresAt: new Date('2026-11-18T10:00:00.000Z'),
        }),
      );
      const token = newToken();
      await tokens.issue(token);

      await expect(
        tokens.completeReset({ token: token.markUsed(later), passwordHash: 'new-argon2-hash' }),
      ).resolves.toBe(true);

      const stored = await db.prisma.passwordResetToken.findUniqueOrThrow({
        where: { id: token.id },
      });
      expect(stored).toMatchObject({ status: 'USED', usedAt: later });
      const user = await db.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.passwordHash).toBe('new-argon2-hash');
      const statuses = await db.prisma.userSession.findMany({
        where: { userId },
        select: { status: true },
      });
      expect(statuses.length).toBeGreaterThanOrEqual(2);
      expect(statuses.every(({ status }) => status === 'REVOKED')).toBe(true);
    });

    it('leaves the sessions and password of other users alone', async () => {
      const token = newToken();
      await tokens.issue(token);
      const before = await db.prisma.user.findUniqueOrThrow({ where: { id: otherUserId } });

      await tokens.completeReset({ token: token.markUsed(later), passwordHash: 'new-hash' });

      const after = await db.prisma.user.findUniqueOrThrow({ where: { id: otherUserId } });
      expect(after.passwordHash).toBe(before.passwordHash);
      const others = await db.prisma.userSession.findMany({ where: { userId: otherUserId } });
      expect(others.every(({ status }) => status === 'ACTIVE')).toBe(true);
    });

    it('lets only one of two simultaneous confirmations of the same link win', async () => {
      const token = newToken();
      await tokens.issue(token);
      const used = token.markUsed(later);

      const results = await Promise.all([
        tokens.completeReset({ token: used, passwordHash: 'first' }),
        tokens.completeReset({ token: used, passwordHash: 'second' }),
      ]);

      expect(results.sort()).toEqual([false, true]);
    });

    it('changes nothing when the token is no longer ACTIVE', async () => {
      const token = newToken();
      await tokens.issue(token);
      await tokens.issue(newToken(userId, later));
      const before = await db.prisma.user.findUniqueOrThrow({ where: { id: userId } });

      await expect(
        tokens.completeReset({ token: token.markUsed(later), passwordHash: 'new-hash' }),
      ).resolves.toBe(false);

      const after = await db.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(after.passwordHash).toBe(before.passwordHash);
      const sessions = await db.prisma.userSession.findMany({ where: { userId } });
      expect(sessions.every(({ status }) => status === 'ACTIVE')).toBe(true);
    });
  });
});
