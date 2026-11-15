import { EmailDeliveryError } from '../../../notifications/domain/errors/email-delivery.error';
import type { BackgroundTasks } from '../../domain/ports/background-tasks';

export interface ErrorLogger {
  error(line: string): void;
}

/**
 * Starts each task on a later turn of the event loop, so the request returns first. A failure is
 * logged and swallowed: only an EmailDeliveryError's message, which is safe by construction, is
 * logged; for anything else just its class, since a message might carry an email or a token.
 */
export class DetachedBackgroundTasks implements BackgroundTasks {
  constructor(private readonly logger: ErrorLogger) {}

  run(description: string, task: () => Promise<void>): void {
    setImmediate(() => {
      task().catch((error: unknown) => {
        const reason =
          error instanceof EmailDeliveryError
            ? error.message
            : error instanceof Error
              ? error.constructor.name
              : typeof error;
        this.logger.error(`${description} failed: ${reason}`);
      });
    });
  }
}
