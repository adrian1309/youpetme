import { Prisma } from '../../../../../platform/database/generated/client';
import type { PrismaService } from '../../../../../platform/database/prisma.service';
import { EmailAlreadyRegisteredError } from '../../../domain/errors/email-already-registered.error';
import { buildAccount } from '../../../testing/build-account';
import { PrismaAccountRegistrationRepository } from './prisma-account-registration.repository';

function repositoryFailingWith(error: unknown): PrismaAccountRegistrationRepository {
  const prisma = { $transaction: () => Promise.reject(error) } as unknown as PrismaService;
  return new PrismaAccountRegistrationRepository(prisma);
}

function uniqueViolation(meta: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta,
  });
}

describe('PrismaAccountRegistrationRepository unique violation mapping', () => {
  it('maps P2002 on the users_email_key index (driver adapter) to EmailAlreadyRegisteredError', async () => {
    const error = uniqueViolation({
      driverAdapterError: { cause: { constraint: { index: 'users_email_key' } } },
    });

    await expect(repositoryFailingWith(error).register(buildAccount())).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });

  it('maps P2002 whose target lists the email field', async () => {
    const error = uniqueViolation({ target: ['email'] });

    await expect(repositoryFailingWith(error).register(buildAccount())).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });

  it('does not map a P2002 on another constraint, even if its message mentions email', async () => {
    const error = uniqueViolation({
      driverAdapterError: {
        cause: {
          constraint: { index: 'user_sessions_pkey' },
          originalMessage: 'duplicate key ... while inserting for email john@example.com',
        },
      },
    });

    await expect(repositoryFailingWith(error).register(buildAccount())).rejects.toBe(error);
  });

  it('does not map a P2002 without target information', async () => {
    const error = uniqueViolation({});

    await expect(repositoryFailingWith(error).register(buildAccount())).rejects.toBe(error);
  });

  it('rethrows other errors untouched', async () => {
    const error = new Error('connection lost');

    await expect(repositoryFailingWith(error).register(buildAccount())).rejects.toBe(error);
  });
});
