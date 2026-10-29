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
});
