import type { PrismaService } from '../../../../../platform/database/prisma.service';
import { User } from '../../../domain/entities/user.entity';
import type { UserAccount, UserRepository } from '../../../domain/ports/user-repository';

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  role: true,
  status: true,
  termsAcceptedAt: true,
  termsVersion: true,
  createdAt: true,
  updatedAt: true,
  profile: { select: { firstName: true, lastName: true } },
} as const;

type AccountRow = {
  [K in Exclude<keyof typeof ACCOUNT_SELECT, 'profile'>]: User[K];
} & { profile: { firstName: string; lastName: string } | null };

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existsByEmail(normalizedEmail: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email: normalizedEmail } });
    return count > 0;
  }

  async findAccountByEmail(normalizedEmail: string): Promise<UserAccount | null> {
    return toAccount(
      await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: ACCOUNT_SELECT,
      }),
    );
  }

  async findAccountById(userId: string): Promise<UserAccount | null> {
    return toAccount(
      await this.prisma.user.findUnique({ where: { id: userId }, select: ACCOUNT_SELECT }),
    );
  }
}

/** Every user is created with its profile in one transaction (TS-IAM-001). */
function toAccount(row: AccountRow | null): UserAccount | null {
  if (!row?.profile) return null;
  const { profile, ...user } = row;
  return {
    user: User.reconstitute(user),
    firstName: profile.firstName,
    lastName: profile.lastName,
  };
}
