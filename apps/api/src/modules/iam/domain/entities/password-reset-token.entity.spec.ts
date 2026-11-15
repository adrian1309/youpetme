import { PasswordResetToken } from './password-reset-token.entity';

const now = new Date('2026-11-11T10:00:00.000Z');
const TWO_HOURS = 2 * 60 * 60 * 1000;

function issued() {
  return PasswordResetToken.issue({
    id: 't-1',
    userId: 'u-1',
    tokenHash: 'sha256-of-token',
    now,
    ttlMs: TWO_HOURS,
  });
}

describe('PasswordResetToken.issue (TS-IAM-004)', () => {
  it('starts ACTIVE, unused, storing only the hash and expiring after the lifetime', () => {
    expect(issued()).toEqual(
      PasswordResetToken.reconstitute({
        id: 't-1',
        userId: 'u-1',
        tokenHash: 'sha256-of-token',
        status: 'ACTIVE',
        expiresAt: new Date('2026-11-11T12:00:00.000Z'),
        usedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  });
});

describe('PasswordResetToken lifecycle', () => {
  it('is usable while ACTIVE and before its expiry', () => {
    const token = issued();

    expect(token.isUsableAt(new Date(now.getTime() + TWO_HOURS - 1))).toBe(true);
  });

  it('is no longer usable from the instant it expires', () => {
    const token = issued();

    expect(token.isExpiredAt(new Date(now.getTime() + TWO_HOURS))).toBe(true);
    expect(token.isUsableAt(new Date(now.getTime() + TWO_HOURS))).toBe(false);
  });

  it.each(['USED', 'EXPIRED', 'SUPERSEDED'] as const)('is not usable once %s', (status) => {
    const token = PasswordResetToken.reconstitute({ ...issued(), status });

    expect(token.isUsableAt(now)).toBe(false);
  });

  it('records when it was used (single use)', () => {
    const later = new Date(now.getTime() + 60_000);

    const used = issued().markUsed(later);

    expect(used).toMatchObject({ status: 'USED', usedAt: later, updatedAt: later });
    expect(used.isUsableAt(later)).toBe(false);
  });

  it('can be marked EXPIRED once its lifetime has passed', () => {
    const later = new Date(now.getTime() + TWO_HOURS);

    expect(issued().expire(later)).toMatchObject({ status: 'EXPIRED', updatedAt: later });
  });
});
