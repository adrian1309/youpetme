import { Global, Module } from '@nestjs/common';

import type { AppConfig } from '../configuration/app-config';
import { APP_CONFIG } from '../configuration/configuration.tokens';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new PrismaService(config.databaseUrl),
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}
