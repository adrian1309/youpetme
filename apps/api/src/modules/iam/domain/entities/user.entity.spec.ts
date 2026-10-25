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
