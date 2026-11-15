import type { EmailDeliveryConfig } from '../../../../platform/configuration/app-config';
import type { EmailSender } from '../../domain/ports/email-sender';
import { ConsoleEmailSender, type LineLogger } from './console-email-sender';
import { FileEmailSender } from './file-email-sender';
import { ResendEmailSender } from './resend-email-sender';

/** Picks the adapter for EMAIL_DELIVERY; the configuration only allows Resend in production. */
export function createEmailSender(config: EmailDeliveryConfig, logger: LineLogger): EmailSender {
  switch (config.delivery) {
    case 'resend':
      return new ResendEmailSender({ apiKey: config.resendApiKey, from: config.from });
    case 'file':
      return new FileEmailSender(config.outboxDir);
    case 'console':
      return new ConsoleEmailSender(logger);
  }
}
