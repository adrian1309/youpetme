import type { EventEmitter2 } from '@nestjs/event-emitter';

import type { DomainEvent } from '../../domain/events/user-created.event';
import type { EventPublisher } from '../../domain/ports/event-publisher';

export interface ErrorLogger {
  error(message: string): void;
}

/**
 * ADR-016: in-process dispatch. Handlers are isolated: a failure is logged (event name and
 * error message only, never the payload) and never reaches the originating request.
 */
export class NestEventPublisher implements EventPublisher {
  constructor(
    private readonly emitter: EventEmitter2,
    private readonly logger: ErrorLogger,
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    const name = event.constructor.name;
    try {
      await this.emitter.emitAsync(name, event);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Handler for ${name} failed: ${reason}`);
    }
  }
}
