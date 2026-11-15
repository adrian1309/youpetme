import { ConsoleEmailSender } from './console-email-sender';
import { createEmailSender } from './create-email-sender';
import { FileEmailSender } from './file-email-sender';
import { ResendEmailSender } from './resend-email-sender';

const logger = { log: () => undefined };

describe('createEmailSender', () => {
  it('sends through Resend when EMAIL_DELIVERY=resend', () => {
    expect(
      createEmailSender(
        { delivery: 'resend', resendApiKey: 're_x', from: 'a@example.com' },
        logger,
      ),
    ).toBeInstanceOf(ResendEmailSender);
  });

  it('prints emails when EMAIL_DELIVERY=console', () => {
    expect(createEmailSender({ delivery: 'console' }, logger)).toBeInstanceOf(ConsoleEmailSender);
  });

  it('writes emails to the outbox when EMAIL_DELIVERY=file', () => {
    expect(
      createEmailSender({ delivery: 'file', outboxDir: '/tmp/outbox' }, logger),
    ).toBeInstanceOf(FileEmailSender);
  });
});
