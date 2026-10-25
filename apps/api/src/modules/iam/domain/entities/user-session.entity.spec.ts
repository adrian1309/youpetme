import { UserSession } from './user-session.entity';

describe('UserSession.create', () => {
  it('starts ACTIVE with the given refresh token hash and expiry', () => {
    const now = new Date('2026-10-25T10:00:00.000Z');
    const expiresAt = new Date('2026-11-01T10:00:00.000Z');

    const session = UserSession.create({
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'sha256-hash',
      now,
      expiresAt,
    });

    expect(session).toMatchObject({
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'sha256-hash',
      status: 'ACTIVE',
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  });
});
