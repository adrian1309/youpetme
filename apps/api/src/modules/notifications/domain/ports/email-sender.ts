/** One transactional email (ADR-014). `text` and `html` carry the same content. */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Lets the provider drop an accidental second delivery of the same message. */
  idempotencyKey?: string;
}

/**
 * Sends transactional email (ADR-014). Owned by Notifications; other modules depend only on this
 * port, never on a provider. Rejects with EmailDeliveryError when the message was not accepted.
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
