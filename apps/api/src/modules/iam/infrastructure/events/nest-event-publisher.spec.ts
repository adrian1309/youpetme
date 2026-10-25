import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserCreated } from '../../domain/events/user-created.event';
import { NestEventPublisher } from './nest-event-publisher';

const event = new UserCreated('user-1', 'john@example.com', new Date('2026-10-25T10:00:00.000Z'));

describe('NestEventPublisher (ADR-016)', () => {
  it('delivers the event to subscribers of its class name', async () => {
    const emitter = new EventEmitter2();
    const received: unknown[] = [];
    emitter.on('UserCreated', (e: unknown) => received.push(e));

    await new NestEventPublisher(emitter, { error: jest.fn() }).publish(event);

    expect(received).toEqual([event]);
  });

  it('isolates handler failures: logs them without rejecting or leaking the payload', async () => {
    const emitter = new EventEmitter2();
    emitter.on('UserCreated', () => {
      throw new Error('welcome email provider down');
    });
    const logger = { error: jest.fn() };

    await expect(new NestEventPublisher(emitter, logger).publish(event)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
    const logged = String(logger.error.mock.calls[0]![0]);
    expect(logged).toContain('UserCreated');
    expect(logged).toContain('welcome email provider down');
    expect(logged).not.toContain('john@example.com');
  });

  it('does not fail when nobody is subscribed', async () => {
    await expect(
      new NestEventPublisher(new EventEmitter2(), { error: jest.fn() }).publish(event),
    ).resolves.toBeUndefined();
  });
});
