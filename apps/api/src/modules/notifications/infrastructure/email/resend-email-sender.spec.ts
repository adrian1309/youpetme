import { EmailDeliveryError } from '../../domain/errors/email-delivery.error';
import type { EmailMessage } from '../../domain/ports/email-sender';
import { ResendEmailSender } from './resend-email-sender';

const message: EmailMessage = {
  to: 'john@example.com',
  subject: 'Subject',
  text: 'Plain text with https://app.example/reset-password?token=secret-token',
  html: '<p>HTML</p>',
  idempotencyKey: 'reset-token-id',
};

function setup(response: Response | Error = new Response('{"id":"1"}', { status: 200 })) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  };
  const sender = new ResendEmailSender(
    { apiKey: 're_test_key', from: 'YouPetMe <no-reply@example.com>' },
    fetchImpl as typeof fetch,
  );
  return { sender, calls };
}

describe('ResendEmailSender', () => {
  it('posts the message to the Resend emails endpoint with the API key', async () => {
    const { sender, calls } = setup();

    await sender.send(message);

    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls as [{ url: string; init: RequestInit }];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer re_test_key',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'reset-token-id',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'YouPetMe <no-reply@example.com>',
      to: ['john@example.com'],
      subject: 'Subject',
      text: message.text,
      html: '<p>HTML</p>',
    });
  });

  it('gives up after a timeout instead of hanging the caller', async () => {
    const { sender, calls } = setup();

    await sender.send(message);

    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('omits the idempotency header when the message has no key', async () => {
    const { sender, calls } = setup();

    await sender.send({ ...message, idempotencyKey: undefined });

    expect(calls[0]!.init.headers).not.toHaveProperty('Idempotency-Key');
  });

  it('rejects with the status only when Resend refuses the message', async () => {
    const { sender } = setup(
      new Response('{"message":"bad key re_test_key for john@example.com"}', { status: 401 }),
    );

    const error = await sender.send(message).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe('Resend rejected the email with status 401');
  });

  it('rejects without network details when Resend cannot be reached', async () => {
    const { sender } = setup(new Error('getaddrinfo ENOTFOUND api.resend.com'));

    const error = await sender.send(message).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe('Resend could not be reached');
  });
});
