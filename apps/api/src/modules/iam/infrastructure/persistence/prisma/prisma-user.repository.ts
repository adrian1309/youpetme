import type { PrismaService } from '../../../../../platform/database/prisma.service';
import type { UserRepository } from '../../../domain/ports/user-repository';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existsByEmail(normalizedEmail: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email: normalizedEmail } });
    return count > 0;
  }
}
