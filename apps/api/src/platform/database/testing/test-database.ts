import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { PrismaService } from '../prisma.service';

export interface TestDatabase {
  readonly prisma: PrismaService;
  readonly connectionUri: string;
  /** Removes every row so each test starts from an empty database. */
  reset(): Promise<void>;
  stop(): Promise<void>;
}

/** Upper bound only: a warm Docker starts the container in seconds. */
const STARTUP_TIMEOUT_MS = 300_000;

/**
 * Integration tests run against a real, isolated PostgreSQL started by Testcontainers (ARCH-002),
 * with the committed migrations applied; never against a development or production database.
 * The image matches infra/docker/compose.yaml.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  // A cold Docker took about 150 s to report PostgreSQL healthy; the default is 120 s.
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:18.6-alpine',
  )
    .withStartupTimeout(STARTUP_TIMEOUT_MS)
    .start();
  const connectionUri = container.getConnectionUri();

  // Run from apps/api (the cwd of `pnpm test:integration`) so prisma.config.ts is picked up.
  execFileSync(
    process.execPath,
    [join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    { env: { ...process.env, DATABASE_URL: connectionUri }, stdio: 'pipe' },
  );

  const prisma = new PrismaService(connectionUri);
  await prisma.$connect();

  return {
    prisma,
    connectionUri,
    async reset() {
      await prisma.$executeRawUnsafe(
        // "shelters" is kept: its single MVP row comes from a migration.
        'TRUNCATE TABLE "animals", "password_reset_tokens", "user_sessions", "user_profiles", "users" RESTART IDENTITY CASCADE',
      );
    },
    async stop() {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
