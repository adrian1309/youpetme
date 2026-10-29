import { randomUUID } from 'node:crypto';

import { UserProfile } from '../domain/entities/user-profile.entity';
import { UserSession } from '../domain/entities/user-session.entity';
import { User } from '../domain/entities/user.entity';
import type { NewAccount } from '../domain/ports/account-registration-repository';
import { Email } from '../domain/value-objects/email';

/** Builds a valid, unpersisted account for tests; every call yields fresh ids. */
export function buildAccount(
  overrides: { email?: string; sessionId?: string; hasSeenWelcome?: boolean } = {},
): NewAccount {
  const now = new Date('2026-10-25T10:00:00.000Z');
  const user = User.register({
    id: randomUUID(),
    email: Email.create(overrides.email ?? `user-${randomUUID()}@example.com`),
    passwordHash: '$argon2id$v=19$m=19456,p=1,t=2$c2FsdA$aGFzaA',
    termsVersion: '2026-01',
    now,
  });
  const profile = UserProfile.create({
    id: randomUUID(),
    userId: user.id,
    firstName: 'John',
    lastName: 'Doe',
    hasSeenWelcome: overrides.hasSeenWelcome,
    now,
  });
  const session = UserSession.create({
    id: overrides.sessionId ?? randomUUID(),
    userId: user.id,
    refreshTokenHash: 'a'.repeat(64),
    now,
    expiresAt: new Date('2026-11-01T10:00:00.000Z'),
  });
  return { user, profile, session };
}
