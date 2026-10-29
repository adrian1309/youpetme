import type { User } from '../entities/user.entity';
import type { UserProfile } from '../entities/user-profile.entity';
import type { UserSession } from '../entities/user-session.entity';

export interface NewAccount {
  user: User;
  profile: UserProfile;
  session: UserSession;
}

/**
 * Transactional boundary of registration: either the three records exist afterwards or none do.
 * Rejects with EmailAlreadyRegisteredError when the unique email constraint is violated.
 */
export interface AccountRegistrationRepository {
  register(account: NewAccount): Promise<void>;
}
