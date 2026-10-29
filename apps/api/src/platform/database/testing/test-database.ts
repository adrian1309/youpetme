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

/**
 * Integration tests run against a real, isolated PostgreSQL started by Testcontainers (ARCH-002),
 * with the committed migrations applied; never against a development or production database.
 * The image matches infra/docker/compose.yaml.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:18.6-alpine',
  ).start();
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
        'TRUNCATE TABLE "user_sessions", "user_profiles", "users" RESTART IDENTITY CASCADE',
      );
    },
    async stop() {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
