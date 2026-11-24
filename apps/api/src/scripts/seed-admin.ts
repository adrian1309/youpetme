import { randomUUID } from 'node:crypto';

import { Email } from '../modules/iam/domain/value-objects/email';
import { PasswordPolicy } from '../modules/iam/domain/value-objects/password-policy';
import { Argon2idPasswordHasher } from '../modules/iam/infrastructure/security/argon2id-password-hasher';
import { PrismaService } from '../platform/database/prisma.service';

/**
 * Provisions the first ADMIN (Domain Model — MVP roles: ADMIN is never created by registration).
 * Credentials come only from environment variables, never from the repository. Running it again
 * with an email that already exists changes nothing.
 *
 *   pnpm --filter @youpetme/api seed:admin
 */
export async function seedAdmin(
  prisma: PrismaService,
  env: Record<string, string | undefined>,
): Promise<'created' | 'exists'> {
  const rawEmail = env.ADMIN_EMAIL ?? '';
  const password = env.ADMIN_PASSWORD ?? '';
  const termsVersion = env.TERMS_VERSION?.trim() ?? '';
  const firstName = env.ADMIN_FIRST_NAME?.trim() || 'Admin';
  const lastName = env.ADMIN_LAST_NAME?.trim() || 'YouPetMe';

  if (Email.validate(rawEmail).length > 0) {
    throw new Error('ADMIN_EMAIL is missing or is not a valid email');
  }
  if (PasswordPolicy.validate(password).length > 0) {
    throw new Error(
      `ADMIN_PASSWORD is missing or not ${PasswordPolicy.MIN_LENGTH}-${PasswordPolicy.MAX_LENGTH} characters long`,
    );
  }
  if (!termsVersion) throw new Error('TERMS_VERSION is missing');

  const email = Email.normalize(rawEmail);
  if (await prisma.user.findUnique({ where: { email } })) return 'exists';

  const now = new Date();
  const userId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        email,
        passwordHash: await new Argon2idPasswordHasher().hash(password),
        role: 'ADMIN',
        status: 'ACTIVE',
        termsAcceptedAt: now,
        termsVersion,
        createdAt: now,
      },
    });
    await tx.userProfile.create({
      data: { id: randomUUID(), userId, firstName, lastName, createdAt: now },
    });
  });
  return 'created';
}

async function main(): Promise<void> {
  try {
    // Same single source as prisma.config.ts: the repository-root .env.
    process.loadEnvFile('../../.env');
  } catch {
    // The variables may come from the process environment instead.
  }
  const prisma = new PrismaService(process.env.DATABASE_URL ?? '');
  try {
    const result = await seedAdmin(prisma, process.env);
    // Never print the password; the email is the owner's own.
    console.log(
      result === 'created'
        ? 'Admin created.'
        : 'An account with ADMIN_EMAIL already exists; nothing changed.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  });
}
