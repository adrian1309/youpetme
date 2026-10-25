import { Prisma } from '../../../../../platform/database/generated/client';
import type { PrismaService } from '../../../../../platform/database/prisma.service';
import { EmailAlreadyRegisteredError } from '../../../domain/errors/email-already-registered.error';
import type {
  AccountRegistrationRepository,
  NewAccount,
} from '../../../domain/ports/account-registration-repository';

export class PrismaAccountRegistrationRepository implements AccountRegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async register({ user, profile, session }: NewAccount): Promise<void> {
    try {
      // One transaction: if any insert fails, no partial account or orphan session remains.
      await this.prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: user.id,
            email: user.email,
            passwordHash: user.passwordHash,
            role: user.role,
            status: user.status,
            termsAcceptedAt: user.termsAcceptedAt,
            termsVersion: user.termsVersion,
            createdAt: user.createdAt,
          },
        });
        await tx.userProfile.create({
          data: {
            id: profile.id,
            userId: profile.userId,
            firstName: profile.firstName,
            lastName: profile.lastName,
            hasSeenWelcome: profile.hasSeenWelcome,
            createdAt: profile.createdAt,
          },
        });
        await tx.userSession.create({
          data: {
            id: session.id,
            userId: session.userId,
            refreshTokenHash: session.refreshTokenHash,
            status: session.status,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
          },
        });
      });
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }
}

/** Name of the unique index on users.email (see the init migration). */
const EMAIL_UNIQUE_INDEX = 'users_email_key';

/**
 * A P2002 on users.email, which is also what a concurrent duplicate registration produces.
 * Driver adapters report the violated index; the classic `meta.target` lists the fields.
 */
function isEmailUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { index?: unknown } } };
      }
    | undefined;
  if (meta?.driverAdapterError?.cause?.constraint?.index === EMAIL_UNIQUE_INDEX) {
    return true;
  }
  return Array.isArray(meta?.target) && meta.target.includes('email');
}
