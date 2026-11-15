/**
 * The email could not be handed to the provider. The message is safe to log: it never carries
 * the recipient, the content or the provider's response body.
 */
export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}
