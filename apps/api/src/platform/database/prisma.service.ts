import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client';

/** The only place that builds the Prisma client; Prisma stays inside infrastructure (ARCH-001). */
export class PrismaService extends PrismaClient {
  constructor(connectionString: string) {
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
