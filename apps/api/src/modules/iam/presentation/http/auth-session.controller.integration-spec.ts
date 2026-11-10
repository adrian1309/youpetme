import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type {
  ErrorResponse,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
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

const ACCESS_SECRET = 'test-access-secret-0123456789abcdef-test';
const REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef-test';
const WEB_ORIGIN = 'http://localhost:5173';
const PASSWORD = 'my-secure-passphrase';
const EMAIL = 'john@example.com';
const LOGIN = '/api/v1/auth/login';
const REFRESH = '/api/v1/auth/refresh';
const LOGOUT = '/api/v1/auth/logout';

const credentials: LoginRequest = { email: EMAIL, password: PASSWORD };

function refreshCookieOf(response: request.Response): string {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((c) => c.startsWith('refresh_token='));
  if (!cookie) throw new Error('No refresh_token cookie was set');
  return cookie;
}

function tokenOf(cookie: string): string {
  return /^refresh_token=([^;]*);/.exec(cookie)![1]!;
}

/** What a browser sends back: just name=value. */
function asRequestCookie(cookie: string): string {
  return cookie.split(';')[0]!;
}

describe('POST /api/v1/auth/login and /api/v1/auth/refresh (PostgreSQL)', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let prisma: PrismaService;
  let output: string;
  const stdout = jest.spyOn(process.stdout, 'write');
  const stderr = jest.spyOn(process.stderr, 'write');
  const jwt = new JwtService();

  const http = () => request(app.getHttpServer());

  async function registerUser(): Promise<string> {
    const body: RegisterRequest = {
      firstName: 'John',
      lastName: 'Doe',
      email: EMAIL,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      termsAccepted: true,
    };
    const response = await http().post('/api/v1/auth/register').send(body).expect(201);
    return (response.body as LoginResponse).user.id;
  }

  async function login(): Promise<request.Response> {
    return http().post(LOGIN).send(credentials).expect(200);
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    Object.assign(process.env, {
      DATABASE_URL: db.connectionUri,
      API_PORT: '3000',
      WEB_ORIGIN,
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      JWT_REFRESH_SECRET: REFRESH_SECRET,
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      TERMS_VERSION: '2026-01',
      COOKIE_SECURE: 'true',
      COOKIE_SAMESITE: 'Strict',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  describe('Login', () => {
    describe('Scenario 1 — Given an ACTIVE account, When the right credentials are sent', () => {
      it('Then it responds 200 with the user and an access token for a new session', async () => {
        const userId = await registerUser();

        const response = await http()
          .post(LOGIN)
          .set('Origin', WEB_ORIGIN)
          .send({ email: '  John@Example.COM ', password: PASSWORD })
          .expect(200);

        const body = response.body as LoginResponse;
        expect(body).toEqual({
          user: { id: userId, firstName: 'John', lastName: 'Doe', email: EMAIL, status: 'ACTIVE' },
          authentication: { accessToken: expect.any(String) },
        });
        expect(JSON.stringify(body)).not.toMatch(/refresh|hash|password/i);
        expect(response.headers['cache-control']).toBe('no-store');

        const claims = await jwt.verifyAsync<{ sub: string; sid: string; role: string }>(
          body.authentication.accessToken,
          { secret: ACCESS_SECRET },
        );
        expect(claims).toMatchObject({ sub: userId, role: 'USER' });
        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: claims.sid } });
        expect(session).toMatchObject({ userId, status: 'ACTIVE' });
      });

      it('Then the refresh token travels only in an HttpOnly, Secure, SameSite=Strict cookie scoped to /api/v1/auth', async () => {
        await registerUser();

        const response = await login();

        const cookie = refreshCookieOf(response);
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('Secure');
        expect(cookie).toContain('SameSite=Strict');
        expect(cookie).toContain('Path=/api/v1/auth');
        const token = tokenOf(cookie);
        expect(JSON.stringify(response.body)).not.toContain(token);
        const { sid } = await jwt.verifyAsync<{ sid: string }>(token, { secret: REFRESH_SECRET });
        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
        expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(
          7 * 24 * 60 * 60 * 1000,
        );
      });
    });

    describe('Scenario 2 — Given wrong credentials', () => {
      it('Then an unknown email and a wrong password get the very same 401', async () => {
        await registerUser();

        const unknownEmail = await http()
          .post(LOGIN)
          .send({ email: 'nobody@example.com', password: PASSWORD })
          .expect(401);
        const wrongPassword = await http()
          .post(LOGIN)
          .send({ email: EMAIL, password: 'not-the-password' })
          .expect(401);

        expect(unknownEmail.body).toEqual({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        });
        expect(wrongPassword.text).toBe(unknownEmail.text);
        for (const response of [unknownEmail, wrongPassword]) {
          expect(response.headers['set-cookie']).toBeUndefined();
        }
        // Only the registration session exists.
        expect(await prisma.userSession.count()).toBe(1);
      });
    });

    describe('Scenario 3 — Given an account that is not ACTIVE', () => {
      it('Then the right credentials get a 403 without the reason, and no session', async () => {
        const userId = await registerUser();
        await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

        const response = await http().post(LOGIN).send(credentials).expect(403);

        expect(response.body).toEqual({
          statusCode: 403,
          error: 'Forbidden',
          message: 'This account is not available',
          code: 'ACCOUNT_NOT_AVAILABLE',
        });
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(await prisma.userSession.count()).toBe(1);
      });
    });

    describe('Scenario 4 — Given a session already open on another device', () => {
      it('Then a new login opens another session and the first one keeps working', async () => {
        await registerUser();

        const first = await login();
        const second = await login();

        expect(tokenOf(refreshCookieOf(second))).not.toBe(tokenOf(refreshCookieOf(first)));
        expect(await prisma.userSession.count({ where: { status: 'ACTIVE' } })).toBe(3);
        await http()
          .post(REFRESH)
          .set('Cookie', asRequestCookie(refreshCookieOf(first)))
          .expect(200);
      });
    });

    describe('Given invalid input', () => {
      it('Then missing fields get a 400 with one detail per field', async () => {
        const response = await http().post(LOGIN).send({}).expect(400);

        expect((response.body as ErrorResponse).details).toEqual([
          { field: 'email', code: 'REQUIRED', message: 'This field is required' },
          { field: 'password', code: 'REQUIRED', message: 'This field is required' },
        ]);
      });

      it('Then a malformed email or a wrongly typed field gets a 400', async () => {
        const malformed = await http()
          .post(LOGIN)
          .send({ email: 'not-an-email', password: PASSWORD })
          .expect(400);
        const wrongType = await http()
          .post(LOGIN)
          .send({ email: EMAIL, password: 12345678 })
          .expect(400);

        expect((malformed.body as ErrorResponse).details).toEqual([
          { field: 'email', code: 'INVALID_FORMAT', message: 'This field has an invalid format' },
        ]);
        expect((wrongType.body as ErrorResponse).details).toEqual([
          { field: 'password', code: 'INVALID_TYPE', message: 'This field has an invalid type' },
        ]);
      });
    });
  });

  describe('Refresh', () => {
    describe('Scenario 5 — Given an active session, When its refresh cookie is sent', () => {
      it('Then it responds 200 with the user, a new access token and a rotated cookie', async () => {
        const userId = await registerUser();
        const cookie = refreshCookieOf(await login());

        const response = await http()
          .post(REFRESH)
          .set('Origin', WEB_ORIGIN)
          .set('Cookie', asRequestCookie(cookie))
          .expect(200);

        const body = response.body as RefreshResponse;
        expect(body).toEqual({
          user: { id: userId, firstName: 'John', lastName: 'Doe', email: EMAIL, status: 'ACTIVE' },
          authentication: { accessToken: expect.any(String) },
        });
        expect(response.headers['cache-control']).toBe('no-store');
        const rotated = refreshCookieOf(response);
        expect(rotated).toContain('HttpOnly');
        expect(rotated).toContain('SameSite=Strict');
        expect(rotated).toContain('Path=/api/v1/auth');
        expect(tokenOf(rotated)).not.toBe(tokenOf(cookie));
        expect(JSON.stringify(body)).not.toContain(tokenOf(rotated));
      });

      it('Then the session keeps its id, gets the new hash and a lifetime restarted from now', async () => {
        await registerUser();
        const cookie = refreshCookieOf(await login());
        const { sid } = jwt.decode<{ sid: string }>(tokenOf(cookie));
        const before = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });

        const response = await http().post(REFRESH).set('Cookie', asRequestCookie(cookie));

        const after = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
        expect(jwt.decode<{ sid: string }>(tokenOf(refreshCookieOf(response))).sid).toBe(sid);
        expect(after.status).toBe('ACTIVE');
        expect(after.refreshTokenHash).not.toBe(before.refreshTokenHash);
        expect(after.expiresAt.getTime()).toBeGreaterThanOrEqual(before.expiresAt.getTime());
      });
    });

    describe('Scenario 6 — Given a session that cannot be renewed', () => {
      async function expectNotRenewable(response: request.Response) {
        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'The session could not be renewed',
          code: 'SESSION_NOT_RENEWABLE',
        });
        // The dead cookie is removed so the browser stops sending it.
        const cleared = refreshCookieOf(response);
        expect(cleared).toMatch(/^refresh_token=;/);
        expect(cleared).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        expect(cleared).toContain('Path=/api/v1/auth');
      }

      it('Then a request without the cookie gets a 401', async () => {
        await expectNotRenewable(await http().post(REFRESH));
      });

      it('Then a cookie signed with another secret gets a 401', async () => {
        const forged = await jwt.signAsync(
          { sub: 'u', sid: '00000000-0000-4000-8000-000000000000' },
          { secret: 'x'.repeat(40) },
        );

        await expectNotRenewable(
          await http().post(REFRESH).set('Cookie', `refresh_token=${forged}`),
        );
      });

      it('Then reusing an already rotated cookie gets a 401 and revokes the session, so the newer cookie stops working too', async () => {
        await registerUser();
        const original = refreshCookieOf(await login());
        const { sid } = jwt.decode<{ sid: string }>(tokenOf(original));
        const renewed = refreshCookieOf(
          await http().post(REFRESH).set('Cookie', asRequestCookie(original)).expect(200),
        );

        await expectNotRenewable(
          await http().post(REFRESH).set('Cookie', asRequestCookie(original)),
        );

        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
        expect(session.status).toBe('REVOKED');
        await expectNotRenewable(
          await http().post(REFRESH).set('Cookie', asRequestCookie(renewed)),
        );
      });

      it('Then a session past its expiry gets a 401 and is marked EXPIRED', async () => {
        await registerUser();
        const cookie = refreshCookieOf(await login());
        const { sid } = jwt.decode<{ sid: string }>(tokenOf(cookie));
        await prisma.userSession.update({
          where: { id: sid },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });

        await expectNotRenewable(await http().post(REFRESH).set('Cookie', asRequestCookie(cookie)));

        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
        expect(session.status).toBe('EXPIRED');
      });

      it('Then a revoked session gets a 401', async () => {
        await registerUser();
        const cookie = refreshCookieOf(await login());
        const { sid } = jwt.decode<{ sid: string }>(tokenOf(cookie));
        await prisma.userSession.update({ where: { id: sid }, data: { status: 'REVOKED' } });

        await expectNotRenewable(await http().post(REFRESH).set('Cookie', asRequestCookie(cookie)));
      });

      describe('absolute session lifetime (SCRUM-54, 30 days by default)', () => {
        const DAY = 24 * 60 * 60 * 1000;

        async function signedInSessionAged(days: number) {
          await registerUser();
          const cookie = refreshCookieOf(await login());
          const { sid } = jwt.decode<{ sid: string }>(tokenOf(cookie));
          const createdAt = new Date(Date.now() - days * DAY);
          // Only the creation moves back: the stored sliding expiry stays in the future.
          await prisma.userSession.update({ where: { id: sid }, data: { createdAt } });
          return { cookie, sid, createdAt };
        }

        it('Then a session older than the cap gets a 401, loses its cookie and is marked EXPIRED', async () => {
          const { cookie, sid } = await signedInSessionAged(31);

          await expectNotRenewable(
            await http().post(REFRESH).set('Cookie', asRequestCookie(cookie)),
          );

          const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
          expect(session.status).toBe('EXPIRED');
        });

        it('Then near the cap a refresh still works, but the new expiry stops at the cap', async () => {
          const { cookie, sid, createdAt } = await signedInSessionAged(26);

          const response = await http()
            .post(REFRESH)
            .set('Cookie', asRequestCookie(cookie))
            .expect(200);

          const cap = createdAt.getTime() + 30 * DAY;
          const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
          expect(session.status).toBe('ACTIVE');
          expect(session.expiresAt.getTime()).toBe(cap);
          const cookieExpiry = /Expires=([^;]+)/.exec(refreshCookieOf(response))![1]!;
          // Cookie dates have one-second resolution.
          expect(Math.abs(new Date(cookieExpiry).getTime() - cap)).toBeLessThan(1000);
        });
      });
    });

    describe('Given an account that is no longer ACTIVE', () => {
      it('Then it gets a 403 and the session is left as it was', async () => {
        const userId = await registerUser();
        const cookie = refreshCookieOf(await login());
        const { sid } = jwt.decode<{ sid: string }>(tokenOf(cookie));
        await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

        const response = await http()
          .post(REFRESH)
          .set('Cookie', asRequestCookie(cookie))
          .expect(403);

        expect((response.body as ErrorResponse).code).toBe('ACCOUNT_NOT_AVAILABLE');
        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
        expect(session.status).toBe('ACTIVE');
      });
    });
  });

  describe('Logout (US-IAM-003, TS-IAM-003)', () => {
    /** A signed-in device: its access token and its refresh cookie, as a browser would hold them. */
    async function device() {
      const response = await login();
      const refreshToken = tokenOf(refreshCookieOf(response));
      return {
        accessToken: (response.body as LoginResponse).authentication.accessToken,
        refreshToken,
        cookie: asRequestCookie(refreshCookieOf(response)),
        sid: jwt.decode<{ sid: string }>(refreshToken).sid,
      };
    }

    function logout(accessToken: string | undefined, cookie: string | undefined) {
      let call = http().post(LOGOUT);
      if (accessToken !== undefined) call = call.set('Authorization', `Bearer ${accessToken}`);
      if (cookie !== undefined) call = call.set('Cookie', cookie);
      return call;
    }

    function expectCookieCleared(response: request.Response) {
      const cleared = refreshCookieOf(response);
      expect(cleared).toMatch(/^refresh_token=;/);
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      expect(cleared).toContain('Path=/api/v1/auth');
      expect(cleared).toContain('HttpOnly');
    }

    describe('Scenario 1 — Given an authenticated user, When they log out', () => {
      it('Then it answers 204 without a body, clears the cookie and revokes the session', async () => {
        await registerUser();
        const { accessToken, cookie, sid } = await device();

        const response = await logout(accessToken, cookie).set('Origin', WEB_ORIGIN).expect(204);

        expect(response.text).toBe('');
        expect(response.headers['cache-control']).toBe('no-store');
        expectCookieCleared(response);
        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
        expect(session.status).toBe('REVOKED');
      });

      it('Then the revoked refresh token can no longer renew the session', async () => {
        await registerUser();
        const { accessToken, cookie } = await device();
        await logout(accessToken, cookie).expect(204);

        const refresh = await http().post(REFRESH).set('Cookie', cookie).expect(401);

        expect((refresh.body as ErrorResponse).code).toBe('SESSION_NOT_RENEWABLE');
      });
    });

    describe('Scenario 2 — Given sessions on two devices, When the user logs out on device A', () => {
      it('Then the session of device B stays ACTIVE and keeps renewing', async () => {
        await registerUser();
        const deviceA = await device();
        const deviceB = await device();

        await logout(deviceA.accessToken, deviceA.cookie).expect(204);

        const sessionB = await prisma.userSession.findUniqueOrThrow({ where: { id: deviceB.sid } });
        expect(sessionB.status).toBe('ACTIVE');
        await http().post(REFRESH).set('Cookie', deviceB.cookie).expect(200);
      });
    });

    describe('Given nothing left to revoke (L2: idempotent)', () => {
      it('Then logging out twice answers 204 both times', async () => {
        await registerUser();
        const { accessToken, cookie } = await device();

        await logout(accessToken, cookie).expect(204);
        expectCookieCleared(await logout(accessToken, cookie).expect(204));
      });

      it.each([
        ['no refresh cookie', undefined],
        ['a cookie that is not a valid token', 'refresh_token=garbage'],
      ])(
        'Then %s still answers 204 and clears the cookie, revoking nothing',
        async (_case, cookie) => {
          await registerUser();
          const { accessToken } = await device();

          expectCookieCleared(await logout(accessToken, cookie).expect(204));
          expect(await prisma.userSession.count({ where: { status: 'REVOKED' } })).toBe(0);
        },
      );
    });

    describe('Given no valid access token (TS-IAM-003: 401)', () => {
      it.each([
        ['no Authorization header', undefined],
        ['a malformed token', 'not-a-jwt'],
        ['an expired access token', 'EXPIRED'],
        ['a token signed with another secret', 'FOREIGN'],
        ['the refresh token used as a Bearer token', 'REFRESH'],
      ])('Then %s gets a 401 and nothing is revoked', async (_case, kind) => {
        await registerUser();
        const { cookie, sid, refreshToken } = await device();
        const claims = { sub: 'x', sid, role: 'USER' };
        const bearer =
          kind === 'EXPIRED'
            ? await jwt.signAsync(
                { ...claims, exp: Math.floor(Date.now() / 1000) - 60 },
                { secret: ACCESS_SECRET },
              )
            : kind === 'FOREIGN'
              ? await jwt.signAsync(claims, { secret: 'z'.repeat(40) })
              : kind === 'REFRESH'
                ? refreshToken
                : kind;

        const response = await logout(bearer, cookie).expect(401);

        expect(response.body).toEqual({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Request could not be processed',
        });
        expect(response.headers['set-cookie']).toBeUndefined();
        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
        expect(session.status).toBe('ACTIVE');
      });

      it("Then another user's access token cannot close this session (L1)", async () => {
        await registerUser();
        const victim = await device();
        await http()
          .post('/api/v1/auth/register')
          .send({
            firstName: 'Eve',
            lastName: 'Doe',
            email: 'eve@example.com',
            password: PASSWORD,
            confirmPassword: PASSWORD,
            termsAccepted: true,
          })
          .expect(201);
        const intruder = await http()
          .post(LOGIN)
          .send({ email: 'eve@example.com', password: PASSWORD })
          .expect(200);
        const intruderToken = (intruder.body as LoginResponse).authentication.accessToken;

        await logout(intruderToken, victim.cookie).expect(401);

        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: victim.sid } });
        expect(session.status).toBe('ACTIVE');
      });
    });

    describe('Cross-site request protection (ADR-002)', () => {
      it('rejects another Origin with 403 before anything else, and revokes nothing', async () => {
        await registerUser();
        const { accessToken, cookie, sid } = await device();

        const response = await logout(accessToken, cookie)
          .set('Origin', 'https://evil.example')
          .expect(403);

        expect(response.headers['set-cookie']).toBeUndefined();
        const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sid } });
        expect(session.status).toBe('ACTIVE');
      });

      it('rejects a text/plain body with 415', async () => {
        await registerUser();
        const { accessToken, cookie } = await device();

        await logout(accessToken, cookie).set('Content-Type', 'text/plain').send('x').expect(415);
      });
    });

    it('writes no token, cookie or hash to the logs', async () => {
      await registerUser();
      const { accessToken, cookie, refreshToken } = await device();
      await logout(accessToken, cookie).expect(204);
      await logout('not-a-jwt', cookie).expect(401);

      const session = await prisma.userSession.findFirstOrThrow({ where: { status: 'REVOKED' } });
      for (const secret of [accessToken, refreshToken, session.refreshTokenHash]) {
        expect(output).not.toContain(secret);
      }
    });
  });

  describe('Cross-site request protection', () => {
    it.each([LOGIN, REFRESH])(
      'rejects another Origin on %s with 403 and sets no cookie',
      async (path) => {
        await registerUser();
        const cookie = refreshCookieOf(await login());

        const response = await http()
          .post(path)
          .set('Origin', 'https://evil.example')
          .set('Cookie', asRequestCookie(cookie))
          .send(credentials)
          .expect(403);

        expect(response.body).toEqual({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Request could not be processed',
        });
        expect(response.headers['set-cookie']).toBeUndefined();
      },
    );

    it('rejects a form-encoded login with 415', async () => {
      await http().post(LOGIN).type('form').send(credentials).expect(415);
    });
  });

  describe('Logging', () => {
    it('writes no password, email, hash or token to the logs', async () => {
      await registerUser();
      const loginResponse = await login();
      const cookie = refreshCookieOf(loginResponse);
      await http().post(LOGIN).send({ email: EMAIL, password: 'wrong-password' }).expect(401);
      const refreshed = await http().post(REFRESH).set('Cookie', asRequestCookie(cookie));
      await http().post(REFRESH).set('Cookie', asRequestCookie(cookie)).expect(401);

      const user = await prisma.user.findFirstOrThrow();
      for (const secret of [
        PASSWORD,
        'wrong-password',
        EMAIL,
        user.passwordHash,
        tokenOf(cookie),
        tokenOf(refreshCookieOf(refreshed)),
        (loginResponse.body as LoginResponse).authentication.accessToken,
        (refreshed.body as RefreshResponse).authentication.accessToken,
      ]) {
        expect(output).not.toContain(secret);
      }
    });
  });

  describe('OpenAPI', () => {
    it('documents both endpoints, their responses and the refresh cookie', () => {
      const document = buildOpenApiDocument(app);

      const loginOperation = document.paths[LOGIN]?.post;
      const refreshOperation = document.paths[REFRESH]?.post;
      expect(Object.keys(loginOperation!.responses)).toEqual(
        expect.arrayContaining(['200', '400', '401', '403', '415', '500']),
      );
      expect(Object.keys(refreshOperation!.responses)).toEqual(
        expect.arrayContaining(['200', '401', '403', '500']),
      );
      expect(JSON.stringify(loginOperation)).toContain('refresh_token');
      expect(JSON.stringify(refreshOperation)).toContain('refresh_token');
    });

    it('documents logout as a Bearer-protected endpoint with its responses', () => {
      const document = buildOpenApiDocument(app);

      const logoutOperation = document.paths[LOGOUT]?.post;
      expect(Object.keys(logoutOperation!.responses)).toEqual(
        expect.arrayContaining(['204', '401', '403', '415', '500']),
      );
      expect(logoutOperation!.security).toEqual([{ bearer: [] }]);
      expect(JSON.stringify(logoutOperation)).toContain('refresh_token');
    });
  });
});
