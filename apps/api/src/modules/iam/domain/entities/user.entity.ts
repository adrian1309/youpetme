import type { Email } from '../value-objects/email';
import type { Role, UserStatus } from '../value-objects/account-states';

export interface RegisterUserProps {
  id: string;
  email: Email;
  passwordHash: string;
  termsVersion: string;
  now: Date;
}

export interface UserSnapshot {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  termsAcceptedAt: Date;
  termsVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(
    readonly id: string,
    readonly email: string,
    readonly passwordHash: string,
    readonly role: Role,
    readonly status: UserStatus,
    readonly termsAcceptedAt: Date,
    readonly termsVersion: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  /** Public registration always yields an active USER; ADMIN is never created this way. */
  static register(props: RegisterUserProps): User {
    return new User(
      props.id,
      props.email.value,
      props.passwordHash,
      'USER',
      'ACTIVE',
      props.now,
      props.termsVersion,
      props.now,
      props.now,
    );
  }

  static reconstitute(snapshot: UserSnapshot): User {
    return new User(
      snapshot.id,
      snapshot.email,
      snapshot.passwordHash,
      snapshot.role,
      snapshot.status,
      snapshot.termsAcceptedAt,
      snapshot.termsVersion,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  /** Only an ACTIVE account may sign in or renew a session (TS-IAM-002). */
  canSignIn(): boolean {
    return this.status === 'ACTIVE';
  }
}
