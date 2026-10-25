import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../../platform/database/testing/test-database';
import { EmailAlreadyRegisteredError } from '../../../domain/errors/email-already-registered.error';
import { buildAccount } from '../../../testing/build-account';
import { PrismaAccountRegistrationRepository } from './prisma-account-registration.repository';

describe('PrismaAccountRegistrationRepository (PostgreSQL)', () => {
  let db: TestDatabase;
  let repository: PrismaAccountRegistrationRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    repository = new PrismaAccountRegistrationRepository(db.prisma);
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await db.stop();
  });

  it('persists User, UserProfile and UserSession with the Domain Model fields', async () => {
    const account = buildAccount({ hasSeenWelcome: true });

    await repository.register(account);

    const user = await db.prisma.user.findUniqueOrThrow({
      where: { id: account.user.id },
      include: { profile: true, sessions: true },
    });
    expect(user).toMatchObject({
      id: account.user.id,
      email: account.user.email,
      passwordHash: account.user.passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      termsAcceptedAt: account.user.termsAcceptedAt,
      termsVersion: '2026-01',
    });
    expect(user.profile).toMatchObject({
      id: account.profile.id,
      userId: account.user.id,
      firstName: 'John',
      lastName: 'Doe',
      hasSeenWelcome: true,
      matchingPreferences: null,
    });
    expect(user.sessions).toHaveLength(1);
    expect(user.sessions[0]).toMatchObject({
      id: account.session.id,
      refreshTokenHash: 'a'.repeat(64),
      status: 'ACTIVE',
      expiresAt: account.session.expiresAt,
    });
  });

  it('defaults hasSeenWelcome to false', async () => {
    const account = buildAccount();

    await repository.register(account);

    const profile = await db.prisma.userProfile.findUniqueOrThrow({
      where: { userId: account.user.id },
    });
    expect(profile.hasSeenWelcome).toBe(false);
  });

  it('is atomic: when the last insert fails nothing is left behind', async () => {
    const first = buildAccount();
    await repository.register(first);
    // Same session id as an existing row: the session insert (last step) violates its primary key.
    const second = buildAccount({ sessionId: first.session.id });

    await expect(repository.register(second)).rejects.not.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );

    expect(await db.prisma.user.findUnique({ where: { id: second.user.id } })).toBeNull();
    expect(await db.prisma.userProfile.findUnique({ where: { id: second.profile.id } })).toBeNull();
    expect(await db.prisma.user.count()).toBe(1);
    expect(await db.prisma.userSession.count()).toBe(1);
  });

  it('translates the unique email constraint into EmailAlreadyRegisteredError', async () => {
    await repository.register(buildAccount({ email: 'john@example.com' }));

    await expect(
      repository.register(buildAccount({ email: 'john@example.com' })),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

    expect(await db.prisma.user.count()).toBe(1);
    expect(await db.prisma.userProfile.count()).toBe(1);
    expect(await db.prisma.userSession.count()).toBe(1);
  });

  it('lets exactly one of two concurrent registrations with the same email win', async () => {
    const results = await Promise.allSettled([
      repository.register(buildAccount({ email: 'race@example.com' })),
      repository.register(buildAccount({ email: 'race@example.com' })),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(await db.prisma.user.count()).toBe(1);
    expect(await db.prisma.userProfile.count()).toBe(1);
  });

  it('rejects at database level an email that is not normalized', async () => {
    const now = new Date();
    await expect(
      db.prisma.user.create({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'John@Example.com',
          passwordHash: 'hash',
          role: 'USER',
          status: 'ACTIVE',
          termsAcceptedAt: now,
          termsVersion: '2026-01',
        },
      }),
    ).rejects.toThrow();
  });
});
