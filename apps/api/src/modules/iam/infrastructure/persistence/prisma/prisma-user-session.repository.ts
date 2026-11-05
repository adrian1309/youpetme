import type { PrismaService } from '../../../../../platform/database/prisma.service';
import { UserSession } from '../../../domain/entities/user-session.entity';
import type { UserSessionRepository } from '../../../domain/ports/user-session-repository';

export class PrismaUserSessionRepository implements UserSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(session: UserSession): Promise<void> {
    await this.prisma.userSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        refreshTokenHash: session.refreshTokenHash,
        status: session.status,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  }

  async findById(sessionId: string): Promise<UserSession | null> {
    const row = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
    return row ? UserSession.reconstitute(row) : null;
  }

  /** A single conditional UPDATE, so two concurrent rotations of one token cannot both win. */
  async rotate(rotated: UserSession, expectedHash: string): Promise<boolean> {
    const { count } = await this.prisma.userSession.updateMany({
      where: { id: rotated.id, refreshTokenHash: expectedHash, status: 'ACTIVE' },
      data: {
        refreshTokenHash: rotated.refreshTokenHash,
        expiresAt: rotated.expiresAt,
        updatedAt: rotated.updatedAt,
      },
    });
    return count === 1;
  }

  async end(session: UserSession): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: session.id, status: 'ACTIVE' },
      data: { status: session.status, updatedAt: session.updatedAt },
    });
  }
}
