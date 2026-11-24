import { startTestDatabase, type TestDatabase } from '../platform/database/testing/test-database';
import { seedAdmin } from './seed-admin';

const env = {
  ADMIN_EMAIL: ' Admin@Example.com ',
  ADMIN_PASSWORD: 'a-long-admin-passphrase',
  TERMS_VERSION: '2026-01',
};

describe('seedAdmin (PostgreSQL)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await db.stop();
  });

  it('creates an ACTIVE ADMIN with a profile and an Argon2id hash, never the plain password', async () => {
    expect(await seedAdmin(db.prisma, env)).toBe('created');

    const user = await db.prisma.user.findUniqueOrThrow({
      where: { email: 'admin@example.com' },
      include: { profile: true },
    });
    expect(user).toMatchObject({ role: 'ADMIN', status: 'ACTIVE', termsVersion: '2026-01' });
    expect(user.profile).toMatchObject({ firstName: 'Admin', lastName: 'YouPetMe' });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(env.ADMIN_PASSWORD);
  });

  it('does nothing when the email already exists, so it can be run again', async () => {
    await seedAdmin(db.prisma, env);

    expect(await seedAdmin(db.prisma, env)).toBe('exists');
    expect(await db.prisma.user.count()).toBe(1);
  });

  it('refuses missing or invalid variables and creates nothing', async () => {
    await expect(seedAdmin(db.prisma, { ...env, ADMIN_EMAIL: '' })).rejects.toThrow(/ADMIN_EMAIL/);
    await expect(seedAdmin(db.prisma, { ...env, ADMIN_PASSWORD: 'short' })).rejects.toThrow(
      /ADMIN_PASSWORD/,
    );
    await expect(seedAdmin(db.prisma, { ...env, TERMS_VERSION: '' })).rejects.toThrow(
      /TERMS_VERSION/,
    );
    expect(await db.prisma.user.count()).toBe(0);
  });
});
