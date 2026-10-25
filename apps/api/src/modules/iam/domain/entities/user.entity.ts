import type { Email } from '../value-objects/email';
import type { Role, UserStatus } from '../value-objects/account-states';

export interface RegisterUserProps {
  id: string;
  email: Email;
  passwordHash: string;
  termsVersion: string;
  now: Date;
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
}
