import { EmailAlreadyRegisteredError } from '../../domain/errors/email-already-registered.error';
import { ValidationFailedError } from '../../domain/errors/validation-failed.error';
import { UserCreated } from '../../domain/events/user-created.event';
import {
  CallLog,
  FakePasswordHasher,
  FakeRefreshTokenHasher,
  FakeTokenIssuer,
  FixedClock,
  InMemoryAccounts,
  InMemoryEventPublisher,
  SequentialIdGenerator,
  TEST_IAM_CONFIG,
} from '../../testing/in-memory-iam';
import type { RegisterUserCommand } from '../commands/register-user.command';
import { RegisterUserUseCase } from './register-user.use-case';

const now = new Date('2026-10-25T10:00:00.000Z');

function setup() {
  const log = new CallLog();
  const accounts = new InMemoryAccounts(log);
  const events = new InMemoryEventPublisher(log);
  const useCase = new RegisterUserUseCase(
    accounts,
    accounts,
    new FakePasswordHasher(),
    new FakeRefreshTokenHasher(),
    new FakeTokenIssuer(),
    events,
    new FixedClock(now),
    new SequentialIdGenerator(),
    TEST_IAM_CONFIG,
  );
  return { useCase, accounts, events, log };
}

const validCommand: RegisterUserCommand = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'my-secure-passphrase',
  confirmPassword: 'my-secure-passphrase',
  termsAccepted: true,
};

async function issuesOf(command: RegisterUserCommand) {
  const { useCase } = setup();
  const error = await useCase.execute(command).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationFailedError);
  return (error as ValidationFailedError).issues;
}

describe('RegisterUserUseCase', () => {
  describe('Given valid data', () => {
    it('creates User, UserProfile and UserSession and returns the tokens', async () => {
      const { useCase, accounts } = setup();

      const result = await useCase.execute(validCommand);

      expect(accounts.accounts).toHaveLength(1);
      const { user, profile, session } = accounts.accounts[0]!;
      expect(user).toMatchObject({
        email: 'john@example.com',
        role: 'USER',
        status: 'ACTIVE',
        termsAcceptedAt: now,
        termsVersion: '2026-01',
      });
      expect(profile).toMatchObject({
        userId: user.id,
        firstName: 'John',
        lastName: 'Doe',
        hasSeenWelcome: false,
        matchingPreferences: null,
      });
      expect(session).toMatchObject({ userId: user.id, status: 'ACTIVE' });
      expect(result.user).toEqual({
        id: user.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'ACTIVE',
      });
      expect(result.accessToken).toBe(`access:${user.id}:${session.id}`);
      expect(result.refreshToken).toBe(`refresh:${user.id}:${session.id}`);
    });

    it('stores only hashes: the password hash and the digest of the refresh token', async () => {
      const { useCase, accounts } = setup();

      const result = await useCase.execute(validCommand);

      const { user, session } = accounts.accounts[0]!;
      expect(user.passwordHash).toBe('hashed(my-secure-passphrase)');
      expect(session.refreshTokenHash).toBe(`digest(${result.refreshToken})`);
      const persisted = JSON.stringify(accounts.accounts);
      expect(persisted).not.toContain('confirmPassword');
      expect(persisted).not.toContain('"my-secure-passphrase"');
      expect(persisted).not.toContain(`"${result.refreshToken}"`);
    });

    it('expires the session after the configured refresh token lifetime', async () => {
      const { useCase, accounts } = setup();

      const result = await useCase.execute(validCommand);

      const expected = new Date(now.getTime() + TEST_IAM_CONFIG.refreshTokenTtlMs);
      expect(accounts.accounts[0]!.session.expiresAt).toEqual(expected);
      expect(result.refreshTokenExpiresAt).toEqual(expected);
    });

    it('normalizes the email and trims names before persisting', async () => {
      const { useCase, accounts } = setup();

      const result = await useCase.execute({
        ...validCommand,
        email: '  John@Example.COM ',
        firstName: ' John ',
      });

      expect(accounts.accounts[0]!.user.email).toBe('john@example.com');
      expect(accounts.accounts[0]!.profile.firstName).toBe('John');
      expect(result.user.email).toBe('john@example.com');
    });

    it('keeps hasSeenWelcome = true when the client reports it', async () => {
      const { useCase, accounts } = setup();

      await useCase.execute({ ...validCommand, hasSeenWelcome: true });

      expect(accounts.accounts[0]!.profile.hasSeenWelcome).toBe(true);
    });

    it('publishes UserCreated only after the account is persisted, without sensitive data', async () => {
      const { useCase, events, log, accounts } = setup();

      await useCase.execute({ ...validCommand, correlationId: 'req-1' });

      expect(log.entries).toEqual(['register', 'publish']);
      expect(events.events).toEqual([
        new UserCreated(accounts.accounts[0]!.user.id, 'john@example.com', now, 'req-1'),
      ]);
      expect(JSON.stringify(events.events)).not.toMatch(/hash|password|token/i);
    });
  });

  describe('Given an email that already belongs to an account', () => {
    it('rejects with EmailAlreadyRegisteredError, even if the case differs, and publishes nothing new', async () => {
      const { useCase, events, accounts } = setup();
      await useCase.execute(validCommand);

      await expect(
        useCase.execute({ ...validCommand, email: 'JOHN@example.com' }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

      expect(accounts.accounts).toHaveLength(1);
      expect(events.events).toHaveLength(1);
    });

    it('propagates the conflict raised by the unique constraint (concurrent registration)', async () => {
      const { useCase, accounts, events } = setup();
      accounts.failNextRegisterWith = new EmailAlreadyRegisteredError();

      await expect(useCase.execute(validCommand)).rejects.toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );

      expect(events.events).toHaveLength(0);
    });
  });

  describe('Given invalid input', () => {
    it('rejects a confirmation that differs from the password', async () => {
      expect(await issuesOf({ ...validCommand, confirmPassword: 'another-passphrase' })).toEqual([
        { field: 'confirmPassword', code: 'MISMATCH' },
      ]);
    });

    it('rejects a password shorter than 8 characters', async () => {
      expect(
        await issuesOf({ ...validCommand, password: 'short12', confirmPassword: 'short12' }),
      ).toEqual([{ field: 'password', code: 'TOO_SHORT' }]);
    });

    it('rejects when the terms are not accepted', async () => {
      expect(await issuesOf({ ...validCommand, termsAccepted: false })).toEqual([
        { field: 'termsAccepted', code: 'MUST_BE_TRUE' },
      ]);
    });

    it('reports every empty required field', async () => {
      const issues = await issuesOf({
        firstName: '',
        lastName: ' ',
        email: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false,
      });

      expect(issues).toEqual(
        expect.arrayContaining([
          { field: 'firstName', code: 'REQUIRED' },
          { field: 'lastName', code: 'REQUIRED' },
          { field: 'email', code: 'REQUIRED' },
          { field: 'password', code: 'REQUIRED' },
          { field: 'confirmPassword', code: 'REQUIRED' },
          { field: 'termsAccepted', code: 'MUST_BE_TRUE' },
        ]),
      );
    });

    it('persists and publishes nothing when validation fails', async () => {
      const { useCase, accounts, events } = setup();

      await expect(
        useCase.execute({ ...validCommand, termsAccepted: false }),
      ).rejects.toBeInstanceOf(ValidationFailedError);

      expect(accounts.accounts).toHaveLength(0);
      expect(events.events).toHaveLength(0);
    });
  });

  describe('Given a failure while persisting', () => {
    it('does not publish UserCreated and surfaces the error', async () => {
      const { useCase, accounts, events } = setup();
      accounts.failNextRegisterWith = new Error('database down');

      await expect(useCase.execute(validCommand)).rejects.toThrow('database down');

      expect(events.events).toHaveLength(0);
    });
  });
});
