import type { EmailMessage, EmailSender } from '../../domain/ports/email-sender';

export interface LineLogger {
  log(line: string): void;
}

/**
 * Development adapter (ADR-014): prints the email, reset link included, to the API log instead
 * of sending it. The configuration refuses it in production.
 */
export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly logger: LineLogger) {}

  send(message: EmailMessage): Promise<void> {
    this.logger.log(
      [
        'Email not sent (EMAIL_DELIVERY=console):',
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        message.text,
      ].join('\n'),
    );
    return Promise.resolve();
  }
}
