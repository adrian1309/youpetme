import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  ErrorResponse,
  PasswordResetConfirmRequest,
  RegisterRequest,
} from '@youpetme/contracts';
import request from 'supertest';

import { AppModule } from '../../../../app/app.module';
import { configureApp } from '../../../../app/configure-app';
import { buildOpenApiDocument } from '../../../../app/openapi';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../platform/database/testing/test-database';
import { EMAIL_SENDER } from '../../../notifications/notifications.tokens';
import { InMemoryEmailSender } from '../../../notifications/testing/in-memory-email-sender';

const WEB_ORIGIN = 'http://localhost:5173';
const EMAIL = 'john@example.com';
const OLD_PASSWORD = 'my-secure-passphrase';
const NEW_PASSWORD = 'my-new-passphrase';
const REQUEST = '/api/v1/auth/password-reset/request';
const CONFIRM = '/api/v1/auth/password-reset/confirm';
const GENERIC_202 = { message: 'If an account exists for this email, a reset link has been sent.' };

describe('POST /api/v1/auth/password-reset/request and /confirm (PostgreSQL)', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let prisma: PrismaService;
  let output: string;
  const emails = new InMemoryEmailSender();
  const stdout = jest.spyOn(process.stdout, 'write');
  const stderr = jest.spyOn(process.stderr, 'write');

  const http = () => request(app.getHttpServer());

  async function register(): Promise<string> {
    const body: RegisterRequest = {
      firstName: 'John',
      lastName: 'Doe',
      email: EMAIL,
      password: OLD_PASSWORD,
      confirmPassword: OLD_PASSWORD,
      termsAccepted: true,
    };
    const response = await http().post('/api/v1/auth/register').send(body).expect(201);
    return (response.body as { user: { id: string } }).user.id;
  }

  /** The email is sent after the response, so wait for it to arrive. */
  async function waitForEmails(count: number): Promise<void> {
    for (let attempt = 0; attempt < 100 && emails.sent.length < count; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(emails.sent).toHaveLength(count);
  }

  function tokenOfEmail(index = 0): string {
    const match = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(emails.sent[index]!.text);
    if (!match) throw new Error('No reset link in the email');
    return match[1]!;
  }

  async function requestLink(): Promise<string> {
    // Counted before the request: the email may already have arrived when it returns.
    const before = emails.sent.length;
    await http().post(REQUEST).send({ email: EMAIL }).expect(202);
    await waitForEmails(before + 1);
    return tokenOfEmail(before);
  }

  function confirmBody(token: string, password = NEW_PASSWORD): PasswordResetConfirmRequest {
    return { token, password, confirmPassword: password };
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    Object.assign(process.env, {
      DATABASE_URL: db.connectionUri,
      API_PORT: '3000',
      WEB_ORIGIN,
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef-test',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef-test',
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      TERMS_VERSION: '2026-01',
      COOKIE_SECURE: 'true',
      COOKIE_SAMESITE: 'Strict',
      EMAIL_DELIVERY: 'console',
      PASSWORD_RESET_EXPIRATION: '2h',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_SENDER)
      .useValue(emails)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { webOrigin: WEB_ORIGIN });
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    output = '';
    const capture = (chunk: unknown): boolean => {
      output += String(chunk);
      return true;
    };
    stdout.mockImplementation(capture);
    stderr.mockImplementation(capture);
    emails.sent.length = 0;
    emails.failing = false;
    await db.reset();
  });

  afterEach(() => {
    stdout.mockReset();
    stderr.mockReset();
  });

  afterAll(async () => {
    await app.close();
    await db.stop();
  });

  describe('Request a link', () => {
    it('Scenario 1 — emails a link to an existing account and answers 202 generically', async () => {
      await register();

      const response = await http()
        .post(REQUEST)
        .set('Origin', WEB_ORIGIN)
        .send({ email: '  John@Example.COM ' })
        .expect(202);

      expect(response.body).toEqual(GENERIC_202);
      expect(response.headers['cache-control']).toBe('no-store');
      await waitForEmails(1);
      expect(emails.sent[0]!.to).toBe(EMAIL);
      expect(emails.sent[0]!.text).toContain(`${WEB_ORIGIN}/reset-password?token=`);
    });

    it('stores only the hash of the emailed token', async () => {
      await register();

      const token = await requestLink();

      const rows = await prisma.passwordResetToken.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.tokenHash).not.toBe(token);
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it('Scenario 2 — answers exactly the same for an unknown email, and sends nothing', async () => {
      await register();
      const known = await http().post(REQUEST).send({ email: EMAIL }).expect(202);

      const unknown = await http().post(REQUEST).send({ email: 'nobody@example.com' }).expect(202);

      expect(unknown.text).toBe(known.text);
      expect(unknown.headers['content-type']).toBe(known.headers['content-type']);
      await waitForEmails(1);
    });

    it('answers 202 even when the email provider fails, without logging the address', async () => {
      await register();
      emails.failing = true;

      await http().post(REQUEST).send({ email: EMAIL }).expect(202);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(output).toContain('Password reset email failed');
      expect(output).not.toContain(EMAIL);
    });

    it('rejects an invalid email with the validation codes in details', async () => {
      const response = await http().post(REQUEST).send({ email: 'not-an-email' }).expect(400);

      expect((response.body as ErrorResponse).details).toEqual([
        { field: 'email', code: 'INVALID_FORMAT', message: expect.any(String) },
      ]);
    });

    it('rejects a body that is not an object', async () => {
      const response = await http()
        .post(REQUEST)
        .set('Content-Type', 'application/json')
        .send('["john@example.com"]')
        .expect(400);

      expect((response.body as ErrorResponse).details).toEqual([
        { field: 'body', code: 'INVALID_TYPE', message: expect.any(String) },
      ]);
    });
  });

  describe('Confirm the new password', () => {
    it('Scenario 3 — changes the password, revokes every session and does not sign in', async () => {
      await register();
      await http().post('/api/v1/auth/login').send({ email: EMAIL, password: OLD_PASSWORD });
      const token = await requestLink();

      const response = await http()
        .post(CONFIRM)
        .set('Origin', WEB_ORIGIN)
        .send(confirmBody(token))
        .expect(200);

      expect(response.body).toEqual({ message: 'Password has been reset successfully.' });
      expect(response.headers['set-cookie']).toBeUndefined();
      const sessions = await prisma.userSession.findMany();
      expect(sessions).toHaveLength(2);
      expect(sessions.every(({ status }) => status === 'REVOKED')).toBe(true);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: EMAIL, password: NEW_PASSWORD })
        .expect(200);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: EMAIL, password: OLD_PASSWORD })
        .expect(401);
      expect(output).not.toContain(token);
      expect(output).not.toContain(NEW_PASSWORD);
    });

    it('ends a session that was open, so its refresh token stops working', async () => {
      await register();
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email: EMAIL, password: OLD_PASSWORD })
        .expect(200);
      const cookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      // Fetched first: supertest must not start this request while another one is in flight.
      const token = await requestLink();
      await http().post(CONFIRM).send(confirmBody(token)).expect(200);

      const refresh = await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
      expect((refresh.body as ErrorResponse).code).toBe('SESSION_NOT_RENEWABLE');
    });

    it('Scenario 4 — rejects a link used before with RESET_TOKEN_INVALID', async () => {
      await register();
      const token = await requestLink();
      await http().post(CONFIRM).send(confirmBody(token)).expect(200);

      const response = await http()
        .post(CONFIRM)
        .send(confirmBody(token, 'another-passphrase'))
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'This reset link is no longer valid',
        code: 'RESET_TOKEN_INVALID',
      });
    });

    it('Scenario 4 — rejects an expired link the same way and marks it EXPIRED', async () => {
      await register();
      const token = await requestLink();
      await prisma.passwordResetToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const response = await http().post(CONFIRM).send(confirmBody(token)).expect(400);

      expect((response.body as ErrorResponse).code).toBe('RESET_TOKEN_INVALID');
      const [row] = await prisma.passwordResetToken.findMany();
      expect(row!.status).toBe('EXPIRED');
    });

    it('rejects a link superseded by a newer one, which still works', async () => {
      await register();
      const first = await requestLink();
      await prisma.passwordResetToken.updateMany({
        data: { createdAt: new Date(Date.now() - 61_000) },
      });
      const second = await requestLink();

      const stale = await http().post(CONFIRM).send(confirmBody(first)).expect(400);
      expect((stale.body as ErrorResponse).code).toBe('RESET_TOKEN_INVALID');
      await http().post(CONFIRM).send(confirmBody(second)).expect(200);
    });

    it('rejects an unknown token the same way', async () => {
      const response = await http().post(CONFIRM).send(confirmBody('forged-token')).expect(400);

      expect((response.body as ErrorResponse).code).toBe('RESET_TOKEN_INVALID');
    });

    it('Scenario 5 — reports a short password and a mismatch in details, keeping the link', async () => {
      await register();
      const token = await requestLink();

      const response = await http()
        .post(CONFIRM)
        .send({ token, password: 'short', confirmPassword: 'shorT' })
        .expect(400);

      expect((response.body as ErrorResponse).details).toEqual([
        { field: 'password', code: 'TOO_SHORT', message: expect.any(String) },
        { field: 'confirmPassword', code: 'MISMATCH', message: expect.any(String) },
      ]);
      expect((response.body as ErrorResponse).code).toBeUndefined();
      await http().post(CONFIRM).send(confirmBody(token)).expect(200);
    });

    it('reports missing fields as REQUIRED', async () => {
      const response = await http().post(CONFIRM).send({}).expect(400);

      expect((response.body as ErrorResponse).details).toEqual([
        { field: 'token', code: 'REQUIRED', message: expect.any(String) },
        { field: 'password', code: 'REQUIRED', message: expect.any(String) },
        { field: 'confirmPassword', code: 'REQUIRED', message: expect.any(String) },
      ]);
    });
  });

  describe('Cross-site request protection (ADR-002)', () => {
    it.each([REQUEST, CONFIRM])('%s rejects a foreign Origin with 403', async (path) => {
      await http().post(path).set('Origin', 'https://evil.example').send({}).expect(403);
    });

    it.each([REQUEST, CONFIRM])('%s rejects a non-JSON Content-Type with 415', async (path) => {
      await http()
        .post(path)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('email=john@example.com')
        .expect(415);
    });
  });

  describe('OpenAPI', () => {
    it('documents both endpoints and their responses', () => {
      const document = buildOpenApiDocument(app);

      expect(Object.keys(document.paths[REQUEST]!.post!.responses)).toEqual(
        expect.arrayContaining(['202', '400', '403', '415', '500']),
      );
      expect(Object.keys(document.paths[CONFIRM]!.post!.responses)).toEqual(
        expect.arrayContaining(['200', '400', '403', '415', '500']),
      );
    });
  });
});
