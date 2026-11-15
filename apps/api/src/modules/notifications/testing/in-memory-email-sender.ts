import { EmailDeliveryError } from '../domain/errors/email-delivery.error';
import type { EmailMessage, EmailSender } from '../domain/ports/email-sender';

/** Records sent emails for unit and integration tests; excluded from production builds. */
export class InMemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  /** When set, every send rejects as a provider outage would. */
  failing = false;

  send(message: EmailMessage): Promise<void> {
    if (this.failing) {
      return Promise.reject(new EmailDeliveryError('Provider unavailable'));
    }
    this.sent.push(message);
    return Promise.resolve();
  }
}
