import type { User } from '../entities/user.entity';

/** A user together with the profile names an authentication response needs. */
export interface UserAccount {
  user: User;
  firstName: string;
  lastName: string;
}

export interface UserRepository {
  /** `normalizedEmail` is already trimmed and lowercase. */
  existsByEmail(normalizedEmail: string): Promise<boolean>;
  /** `normalizedEmail` is already trimmed and lowercase. */
  findAccountByEmail(normalizedEmail: string): Promise<UserAccount | null>;
  findAccountById(userId: string): Promise<UserAccount | null>;
}
