import { Logger, Module } from '@nestjs/common';

import type { AppConfig } from '../../platform/configuration/app-config';
import { APP_CONFIG } from '../../platform/configuration/configuration.tokens';
import { createEmailSender } from './infrastructure/email/create-email-sender';
import { EMAIL_SENDER } from './notifications.tokens';

/**
 * Cross-cutting Notifications module (ARCH-001). For now it only owns transactional email
 * (ADR-014): other modules inject EMAIL_SENDER and depend on the EmailSender port alone.
 */
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createEmailSender(config.email, new Logger('EmailSender')),
    },
  ],
  exports: [EMAIL_SENDER],
})
export class NotificationsModule {}
