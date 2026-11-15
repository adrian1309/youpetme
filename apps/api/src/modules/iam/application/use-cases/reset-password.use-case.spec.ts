import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserSession } from '../../domain/entities/user-session.entity';
import { User } from '../../domain/entities/user.entity';
import { ResetTokenInvalidError } from '../../domain/errors/reset-token-invalid.error';
import { ValidationFailedError } from '../../domain/errors/validation-failed.error';
import { PasswordReset } from '../../domain/events/password-reset.event';
import type {
  PasswordResetTokenStatus,
  UserStatus,
} from '../../domain/value-objects/account-states';
import {
  CallLog,
  FakePasswordHasher,
  FakeRefreshTokenHasher,
  FixedClock,
  InMemoryAccounts,
  InMemoryEventPublisher,
  InMemoryPasswordResetTokens,
  InMemorySessions,
} from '../../testing/in-memory-iam';
import type { ResetPasswordCommand } from '../commands/reset-password.command';
import { ResetPasswordUseCase } from './reset-password.use-case';

const issuedAt = new Date('2026-11-11T10:00:00.000Z');
const now = new Date('2026-11-11T11:00:00.000Z');
const TWO_HOURS = 2 * 60 * 60 * 1000;
const USER_ID = 'user-1';
const TOKEN = 'reset-token-1';
const hasher = new FakeRefreshTokenHasher();

const valid: ResetPasswordCommand = {
  token: TOKEN,
  password: 'my-new-passphrase',
  confirmPassword: 'my-new-passphrase',
};

function setup({
  userStatus = 'ACTIVE' as UserStatus,
  tokenStatus = 'ACTIVE' as PasswordResetTokenStatus,
  clock = now,
} = {}) {
  const log = new CallLog();
  const accounts = new InMemoryAccounts(log);
  const sessions = new InMemorySessions(log);
  const tokens = new InMemoryPasswordResetTokens(sessions, log, () => clock);
  const events = new InMemoryEventPublisher(log);
  accounts.accounts.push({
    user: User.reconstitute({
      id: USER_ID,
      email: 'john@example.com',
      passwordHash: 'hashed(old-passphrase)',
      role: 'USER',
      status: userStatus,
      termsAcceptedAt: issuedAt,
      termsVersion: '2026-01',
      createdAt: issuedAt,
      updatedAt: issuedAt,
    }),
    profile: UserProfile.create({
      id: 'p-1',
      userId: USER_ID,
      firstName: 'John',
      lastName: 'Doe',
      now: issuedAt,
    }),
    session: undefined as never,
  });
  for (const id of ['s-1', 's-2']) {
    sessions.sessions.set(
      id,
      UserSession.create({
        id,
        userId: USER_ID,
        refreshTokenHash: `hash-${id}`,
        now: issuedAt,
        expiresAt: new Date('2026-11-18T10:00:00.000Z'),
      }),
    );
  }
  const token = PasswordResetToken.reconstitute({
    ...PasswordResetToken.issue({
      id: 't-1',
      userId: USER_ID,
      tokenHash: hasher.hash(TOKEN),
      now: issuedAt,
      ttlMs: TWO_HOURS,
    }),
    status: tokenStatus,
  });
  tokens.tokens.set(token.id, token);
  const useCase = new ResetPasswordUseCase(
    accounts,
    tokens,
    hasher,
    new FakePasswordHasher(),
    events,
    new FixedClock(clock),
  );
  return { useCase, tokens, sessions, events, log };
}

async function rejectionOf(
  useCase: ResetPasswordUseCase,
  command: ResetPasswordCommand = valid,
): Promise<unknown> {
  return useCase.execute(command).catch((e: unknown) => e);
}

describe('ResetPasswordUseCase (TS-IAM-004)', () => {
  describe('Given a valid, unexpired link and a valid new password', () => {
    it('stores the new password hash and consumes the token', async () => {
      const { useCase, tokens } = setup();

      await useCase.execute(valid);

      expect(tokens.passwordHashes.get(USER_ID)).toBe('hashed(my-new-passphrase)');
      expect(tokens.tokens.get('t-1')).toMatchObject({ status: 'USED', usedAt: now });
    });

    it('revokes every session of the user (ADR-002, Password Changes)', async () => {
      const { useCase, sessions } = setup();

      await useCase.execute(valid);

      expect([...sessions.sessions.values()].map((s) => s.status)).toEqual(['REVOKED', 'REVOKED']);
    });

    it('publishes PasswordReset after the commit, with no sensitive data', async () => {
      const { useCase, events, log } = setup();

      await useCase.execute(valid);

      expect(events.events).toEqual([new PasswordReset(USER_ID, now)]);
      expect(Object.keys(events.events[0]!).sort()).toEqual(['occurredAt', 'userId']);
      expect(log.entries).toEqual(['completeReset', 'publish']);
    });

    it('cannot be used a second time', async () => {
      const { useCase } = setup();
      await useCase.execute(valid);

      expect(await rejectionOf(useCase)).toBeInstanceOf(ResetTokenInvalidError);
    });
  });

  describe('Given a link that cannot be used (one generic error)', () => {
    it('rejects an unknown token', async () => {
      const { useCase, events } = setup();

      expect(await rejectionOf(useCase, { ...valid, token: 'forged' })).toBeInstanceOf(
        ResetTokenInvalidError,
      );
      expect(events.events).toEqual([]);
    });

    it.each(['USED', 'EXPIRED', 'SUPERSEDED'] as const)(
      'rejects a %s token without touching the account',
      async (tokenStatus) => {
        const { useCase, tokens, sessions } = setup({ tokenStatus });

        expect(await rejectionOf(useCase)).toBeInstanceOf(ResetTokenInvalidError);
        expect(tokens.passwordHashes.size).toBe(0);
        expect([...sessions.sessions.values()].every((s) => s.isActive())).toBe(true);
      },
    );

    it('rejects a token past its lifetime and marks it EXPIRED', async () => {
      const expiry = new Date(issuedAt.getTime() + TWO_HOURS);
      const { useCase, tokens } = setup({ clock: expiry });

      expect(await rejectionOf(useCase)).toBeInstanceOf(ResetTokenInvalidError);
      expect(tokens.tokens.get('t-1')).toMatchObject({ status: 'EXPIRED', updatedAt: expiry });
      expect(tokens.passwordHashes.size).toBe(0);
    });

    it.each(['SUSPENDED', 'DELETED'] as const)(
      'rejects the link of a %s account without consuming it',
      async (userStatus) => {
        const { useCase, tokens } = setup({ userStatus });

        expect(await rejectionOf(useCase)).toBeInstanceOf(ResetTokenInvalidError);
        expect(tokens.tokens.get('t-1')!.status).toBe('ACTIVE');
      },
    );

    it('loses a race with a simultaneous confirmation of the same link', async () => {
      const { useCase, tokens, events } = setup();
      tokens.completeReset = () => Promise.resolve(false);

      expect(await rejectionOf(useCase)).toBeInstanceOf(ResetTokenInvalidError);
      expect(events.events).toEqual([]);
    });
  });

  describe('Given invalid input (same rules as registration)', () => {
    it.each<[string, Partial<ResetPasswordCommand>, { field: string; code: string }[]]>([
      ['a missing token', { token: '' }, [{ field: 'token', code: 'REQUIRED' }]],
      [
        'a password under 8 characters',
        { password: 'short', confirmPassword: 'short' },
        [{ field: 'password', code: 'TOO_SHORT' }],
      ],
      [
        'a password over 128 characters',
        { password: 'a'.repeat(129), confirmPassword: 'a'.repeat(129) },
        [{ field: 'password', code: 'TOO_LONG' }],
      ],
      [
        'a missing password',
        { password: '', confirmPassword: '' },
        [
          { field: 'password', code: 'REQUIRED' },
          { field: 'confirmPassword', code: 'REQUIRED' },
        ],
      ],
      [
        'a confirmation that differs',
        { confirmPassword: 'my-new-passphrasE' },
        [{ field: 'confirmPassword', code: 'MISMATCH' }],
      ],
    ])('reports %s before looking at the link', async (_case, change, issues) => {
      const { useCase, tokens } = setup({ tokenStatus: 'USED' });

      const error = await rejectionOf(useCase, { ...valid, ...change });

      expect(error).toBeInstanceOf(ValidationFailedError);
      expect((error as ValidationFailedError).issues).toEqual(issues);
      expect(tokens.passwordHashes.size).toBe(0);
    });
  });
});
