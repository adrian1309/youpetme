import type { PrismaService } from '../../../../../platform/database/prisma.service';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity';
import type {
  CompletePasswordReset,
  PasswordResetTokenRepository,
} from '../../../domain/ports/password-reset-token-repository';

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    return row ? PasswordResetToken.reconstitute(row) : null;
  }

  async latestIssuedAt(userId: string): Promise<Date | null> {
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }

  async issue(token: PasswordResetToken): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: token.userId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED', updatedAt: token.createdAt },
      });
      await tx.passwordResetToken.create({
        data: {
          id: token.id,
          userId: token.userId,
          tokenHash: token.tokenHash,
          status: token.status,
          expiresAt: token.expiresAt,
          usedAt: token.usedAt,
          createdAt: token.createdAt,
          updatedAt: token.updatedAt,
        },
      });
    });
  }

  async expire(token: PasswordResetToken): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { id: token.id, status: 'ACTIVE' },
      data: { status: token.status, updatedAt: token.updatedAt },
    });
  }

  /**
   * The token is consumed with a conditional UPDATE first: if it is no longer ACTIVE (another
   * confirmation won, or a newer link superseded it) nothing else runs and the transaction
   * changes nothing.
   */
  async completeReset({ token, passwordHash }: CompletePasswordReset): Promise<boolean> {
    const now = token.updatedAt;
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: token.id, status: 'ACTIVE' },
        data: { status: token.status, usedAt: token.usedAt, updatedAt: now },
      });
      if (count !== 1) return false;

      await tx.user.update({ where: { id: token.userId }, data: { passwordHash } });
      await tx.passwordResetToken.updateMany({
        where: { userId: token.userId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED', updatedAt: now },
      });
      // ADR-002, Password Changes: every session ends, not only the current one.
      await tx.userSession.updateMany({
        where: { userId: token.userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', updatedAt: now },
      });
      return true;
    });
  }
}
