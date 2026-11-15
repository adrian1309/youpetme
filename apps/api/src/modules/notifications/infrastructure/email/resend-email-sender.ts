import { EmailDeliveryError } from '../../domain/errors/email-delivery.error';
import type { EmailMessage, EmailSender } from '../../domain/ports/email-sender';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

export interface ResendOptions {
  apiKey: string;
  /** Sender on a domain verified in Resend, e.g. "YouPetMe <no-reply@example.com>". */
  from: string;
}

/**
 * Production adapter (ADR-014): Resend's REST API through fetch, with no SDK. Errors keep only
 * the HTTP status: the response body may echo the recipient or the key.
 */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly options: ResendOptions,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async send(message: EmailMessage): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchImpl(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new EmailDeliveryError('Resend could not be reached');
    }
    if (!response.ok) {
      throw new EmailDeliveryError(`Resend rejected the email with status ${response.status}`);
    }
  }
}
