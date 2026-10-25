import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env by itself; the repository-root .env is the single source (ARCH-001).
try {
  process.loadEnvFile('../../.env');
} catch {
  // CI and Testcontainers provide DATABASE_URL through the process environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
