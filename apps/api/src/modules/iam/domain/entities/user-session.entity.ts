import type { SessionStatus } from '../value-objects/account-states';

export interface CreateUserSessionProps {
  id: string;
  userId: string;
  refreshTokenHash: string;
  now: Date;
  expiresAt: Date;
}

export class UserSession {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly refreshTokenHash: string,
    readonly status: SessionStatus,
    readonly expiresAt: Date,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(props: CreateUserSessionProps): UserSession {
    return new UserSession(
      props.id,
      props.userId,
      props.refreshTokenHash,
      'ACTIVE',
      props.expiresAt,
      props.now,
      props.now,
    );
  }
}
