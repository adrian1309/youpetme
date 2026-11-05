import { Email } from '../value-objects/email';
import { User } from './user.entity';

describe('User.register', () => {
  const now = new Date('2026-10-25T10:00:00.000Z');

  it('creates an ACTIVE USER with the accepted terms recorded', () => {
    const user = User.register({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: Email.create('john@example.com'),
      passwordHash: '$argon2id$hash',
      termsVersion: '2026-01',
      now,
    });

    expect(user).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'john@example.com',
      passwordHash: '$argon2id$hash',
      role: 'USER',
      status: 'ACTIVE',
      termsAcceptedAt: now,
      termsVersion: '2026-01',
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe('User.reconstitute', () => {
  const props = {
    id: 'u-1',
    email: 'john@example.com',
    passwordHash: '$argon2id$hash',
    role: 'USER' as const,
    termsAcceptedAt: new Date('2026-10-25T10:00:00.000Z'),
    termsVersion: '2026-01',
    createdAt: new Date('2026-10-25T10:00:00.000Z'),
    updatedAt: new Date('2026-10-26T10:00:00.000Z'),
  };

  it('restores a persisted user without changing any value', () => {
    const user = User.reconstitute({ ...props, status: 'SUSPENDED' });

    expect(user).toMatchObject({ ...props, status: 'SUSPENDED' });
  });

  it('lets only an ACTIVE account sign in (US-IAM-002, scenario 3)', () => {
    expect(User.reconstitute({ ...props, status: 'ACTIVE' }).canSignIn()).toBe(true);
    expect(User.reconstitute({ ...props, status: 'SUSPENDED' }).canSignIn()).toBe(false);
    expect(User.reconstitute({ ...props, status: 'DELETED' }).canSignIn()).toBe(false);
  });
});
