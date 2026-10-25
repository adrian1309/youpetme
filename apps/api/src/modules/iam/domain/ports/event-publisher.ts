import type { DomainEvent } from '../events/user-created.event';

/**
 * ADR-016: called only after the transaction has committed. Implementations isolate handler
 * failures and must not reject because of them.
 */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
