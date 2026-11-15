import { EmailDeliveryError } from '../../../notifications/domain/errors/email-delivery.error';
import { InMemoryEmailSender } from '../../../notifications/testing/in-memory-email-sender';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { ValidationFailedError } from '../../domain/errors/validation-failed.error';
import type { UserStatus } from '../../domain/value-objects/account-states';
import {
  FakeRefreshTokenHasher,
  InMemoryAccounts,
  InMemoryPasswordResetTokens,
  ManualBackgroundTasks,
  SequentialIdGenerator,
  SequentialResetTokenGenerator,
  TEST_IAM_CONFIG,
} from '../../testing/in-memory-iam';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';

const now = new Date('2026-11-11T10:00:00.000Z');
const USER_ID = 'user-1';

function setup({ status = 'ACTIVE' as UserStatus } = {}) {
  const accounts = new InMemoryAccounts();
  const tokens = new InMemoryPasswordResetTokens();
  const emails = new InMemoryEmailSender();
  const tasks = new ManualBackgroundTasks();
  const clock = { instant: now, now: () => clock.instant };
  accounts.accounts.push({
    user: User.reconstitute({
      id: USER_ID,
      email: 'john@example.com',
      passwordHash: 'hashed(old)',
      role: 'USER',
      status,
      termsAcceptedAt: now,
      termsVersion: '2026-01',
      createdAt: now,
      updatedAt: now,
    }),
    profile: UserProfile.create({
      id: 'p-1',
      userId: USER_ID,
      firstName: 'John',
      lastName: 'Doe',
      now,
    }),
    // Not used by this use case.
    session: undefined as never,
  });
  const useCase = new RequestPasswordResetUseCase(
    accounts,
    tokens,
    new SequentialResetTokenGenerator(),
    new FakeRefreshTokenHasher(),
    emails,
    tasks,
    clock,
    new SequentialIdGenerator(),
    TEST_IAM_CONFIG,
  );
  return { useCase, tokens, emails, tasks, clock };
}

describe('RequestPasswordResetUseCase (TS-IAM-004)', () => {
  describe('Given an ACTIVE account', () => {
    it('stores only the hash of a new token, valid for the configured lifetime', async () => {
      const { useCase, tokens } = setup();

      await useCase.execute({ email: 'john@example.com' });

      expect([...tokens.tokens.values()]).toEqual([
        expect.objectContaining({
          userId: USER_ID,
          tokenHash: 'digest(reset-token-1)',
          status: 'ACTIVE',
          expiresAt: new Date('2026-11-11T12:00:00.000Z'),
        }),
      ]);
    });

    it('emails the reset link only after the request, once the token is stored', async () => {
      const { useCase, emails, tasks, tokens } = setup();

      await useCase.execute({ email: 'john@example.com' });
      expect(emails.sent).toEqual([]);
      await tasks.runAll();

      const [token] = [...tokens.tokens.values()];
      expect(emails.sent).toHaveLength(1);
      expect(emails.sent[0]).toMatchObject({ to: 'john@example.com', idempotencyKey: token!.id });
      expect(emails.sent[0]!.text).toContain(
        'http://localhost:5173/reset-password?token=reset-token-1',
      );
    });

    it('finds the account by its normalized email', async () => {
      const { useCase, tokens } = setup();

      await useCase.execute({ email: '  John@Example.COM ' });

      expect(tokens.tokens.size).toBe(1);
    });

    it('leaves a failed delivery to the background task, never to the request', async () => {
      const { useCase, emails, tasks } = setup();
      emails.failing = true;

      await expect(useCase.execute({ email: 'john@example.com' })).resolves.toBeUndefined();
      await expect(tasks.runAll()).rejects.toBeInstanceOf(EmailDeliveryError);
    });
  });

  describe('Given repeated requests (only the latest link works)', () => {
    it('sends nothing new while the previous link is under a minute old', async () => {
      const { useCase, tokens, emails, tasks, clock } = setup();
      await useCase.execute({ email: 'john@example.com' });

      clock.instant = new Date(now.getTime() + 59_999);
      await useCase.execute({ email: 'john@example.com' });
      await tasks.runAll();

      expect(tokens.tokens.size).toBe(1);
      expect(emails.sent).toHaveLength(1);
    });

    it('supersedes the previous link once the minute has passed', async () => {
      const { useCase, tokens, emails, tasks, clock } = setup();
      await useCase.execute({ email: 'john@example.com' });

      clock.instant = new Date(now.getTime() + 60_000);
      await useCase.execute({ email: 'john@example.com' });
      await tasks.runAll();

      expect([...tokens.tokens.values()].map((t) => t.status)).toEqual(['SUPERSEDED', 'ACTIVE']);
      expect(emails.sent[1]!.text).toContain('token=reset-token-2');
    });
  });

  describe('Given no usable account (nothing reveals it)', () => {
    it('does nothing for an unknown email and answers like for a known one', async () => {
      const { useCase, tokens, tasks } = setup();

      await expect(useCase.execute({ email: 'nobody@example.com' })).resolves.toBeUndefined();

      expect(tokens.tokens.size).toBe(0);
      expect(tasks.pending).toEqual([]);
    });

    it.each(['SUSPENDED', 'DELETED'] as const)('sends nothing to a %s account', async (status) => {
      const { useCase, tokens, tasks } = setup({ status });

      await expect(useCase.execute({ email: 'john@example.com' })).resolves.toBeUndefined();

      expect(tokens.tokens.size).toBe(0);
      expect(tasks.pending).toEqual([]);
    });
  });

  describe('Given an invalid email', () => {
    it.each([
      ['', 'REQUIRED'],
      ['not-an-email', 'INVALID_FORMAT'],
    ])('rejects %j as %s', async (email, code) => {
      const { useCase, tokens } = setup();

      const error = await useCase.execute({ email }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationFailedError);
      expect((error as ValidationFailedError).issues).toEqual([{ field: 'email', code }]);
      expect(tokens.tokens.size).toBe(0);
    });
  });
});
