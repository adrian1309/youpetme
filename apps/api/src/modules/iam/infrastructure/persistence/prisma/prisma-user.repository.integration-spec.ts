import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../../platform/database/testing/test-database';
import { buildAccount } from '../../../testing/build-account';
import { PrismaAccountRegistrationRepository } from './prisma-account-registration.repository';
import { PrismaUserRepository } from './prisma-user.repository';

describe('PrismaUserRepository (PostgreSQL)', () => {
  let db: TestDatabase;
  let users: PrismaUserRepository;

  beforeAll(async () => {
    db = await startTestDatabase();
    users = new PrismaUserRepository(db.prisma);
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await db.stop();
  });

  it('finds an existing account by its normalized email', async () => {
    await new PrismaAccountRegistrationRepository(db.prisma).register(
      buildAccount({ email: 'john@example.com' }),
    );

    await expect(users.existsByEmail('john@example.com')).resolves.toBe(true);
  });

  it('reports false for an unknown email', async () => {
    await expect(users.existsByEmail('nobody@example.com')).resolves.toBe(false);
  });

  describe('findAccountByEmail / findAccountById', () => {
    it('returns the user with its credentials, status and profile names', async () => {
      const account = buildAccount({ email: 'john@example.com' });
      await new PrismaAccountRegistrationRepository(db.prisma).register(account);

      const byEmail = await users.findAccountByEmail('john@example.com');
      const byId = await users.findAccountById(account.user.id);

      for (const found of [byEmail, byId]) {
        expect(found).toEqual({ user: expect.anything(), firstName: 'John', lastName: 'Doe' });
        expect(found!.user).toMatchObject({
          id: account.user.id,
          email: 'john@example.com',
          passwordHash: account.user.passwordHash,
          role: 'USER',
          status: 'ACTIVE',
          termsVersion: '2026-01',
        });
        expect(found!.user.canSignIn()).toBe(true);
      }
    });

    it('reflects a status that is no longer ACTIVE', async () => {
      const account = buildAccount();
      await new PrismaAccountRegistrationRepository(db.prisma).register(account);
      await db.prisma.user.update({
        where: { id: account.user.id },
        data: { status: 'SUSPENDED' },
      });

      const found = await users.findAccountByEmail(account.user.email);

      expect(found!.user.status).toBe('SUSPENDED');
      expect(found!.user.canSignIn()).toBe(false);
    });

    it('returns null for an unknown email or id', async () => {
      await expect(users.findAccountByEmail('nobody@example.com')).resolves.toBeNull();
      await expect(
        users.findAccountById('00000000-0000-4000-8000-000000000000'),
      ).resolves.toBeNull();
    });
  });
});
