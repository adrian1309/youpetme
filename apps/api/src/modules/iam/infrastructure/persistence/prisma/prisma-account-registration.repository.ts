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

/** A unique violation on users.email (also what a concurrent duplicate registration produces). */
function isEmailUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta ?? {}).includes('email')
  );
}
