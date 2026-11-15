import { EmailDeliveryError } from '../../../notifications/domain/errors/email-delivery.error';
import { DetachedBackgroundTasks } from './detached-background-tasks';

function nextTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function setup() {
  const errors: string[] = [];
  const tasks = new DetachedBackgroundTasks({ error: (line: string) => errors.push(line) });
  return { tasks, errors };
}

describe('DetachedBackgroundTasks', () => {
  it('returns before the task starts, so the request does not wait for it', async () => {
    const { tasks } = setup();
    let started = false;

    tasks.run('Task', () => {
      started = true;
      return Promise.resolve();
    });

    expect(started).toBe(false);
    await nextTurn();
    expect(started).toBe(true);
  });

  it('logs the safe reason of a failed delivery and never rethrows it', async () => {
    const { tasks, errors } = setup();

    tasks.run('Password reset email', () =>
      Promise.reject(new EmailDeliveryError('Resend rejected the email with status 503')),
    );
    await nextTurn();
    await nextTurn();

    expect(errors).toEqual([
      'Password reset email failed: Resend rejected the email with status 503',
    ]);
  });

  it('logs only the class of any other error, whose message might carry personal data', async () => {
    const { tasks, errors } = setup();

    tasks.run('Task', () => Promise.reject(new TypeError('john@example.com token=abc')));
    await nextTurn();
    await nextTurn();

    expect(errors).toEqual(['Task failed: TypeError']);
  });
});
