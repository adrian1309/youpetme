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

describe('UserSession lifecycle (ADR-002, Domain Model)', () => {
  const createdAt = new Date('2026-10-25T10:00:00.000Z');
  const expiresAt = new Date('2026-11-01T10:00:00.000Z');
  const active = UserSession.reconstitute({
    id: 's-1',
    userId: 'u-1',
    refreshTokenHash: 'old-hash',
    status: 'ACTIVE',
    expiresAt,
    createdAt,
    updatedAt: createdAt,
  });

  it('reconstitutes a persisted session unchanged', () => {
    expect(active).toMatchObject({
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'old-hash',
      status: 'ACTIVE',
      expiresAt,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('is expired from expiresAt onwards, not before', () => {
    expect(active.isExpiredAt(new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(active.isExpiredAt(expiresAt)).toBe(true);
  });

  it('recognises only the hash of its current refresh token', () => {
    expect(active.matches('old-hash')).toBe(true);
    expect(active.matches('other-hash')).toBe(false);
  });

  it('rotates to a new hash and a new expiry, keeping its identity', () => {
    const now = new Date('2026-10-28T10:00:00.000Z');
    const newExpiry = new Date('2026-11-04T10:00:00.000Z');

    const rotated = active.rotate('new-hash', now, newExpiry);

    expect(rotated).toMatchObject({
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'new-hash',
      status: 'ACTIVE',
      expiresAt: newExpiry,
      createdAt,
      updatedAt: now,
    });
    expect(active.refreshTokenHash).toBe('old-hash');
  });

  it('can be revoked or marked expired', () => {
    const now = new Date('2026-10-28T10:00:00.000Z');

    expect(active.revoke(now)).toMatchObject({ status: 'REVOKED', updatedAt: now });
    expect(active.expire(now)).toMatchObject({ status: 'EXPIRED', updatedAt: now });
  });

  it('is renewable only while ACTIVE', () => {
    const now = new Date('2026-10-28T10:00:00.000Z');

    expect(active.isActive()).toBe(true);
    expect(active.revoke(now).isActive()).toBe(false);
    expect(active.expire(now).isActive()).toBe(false);
  });
});
