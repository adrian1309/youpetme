export interface UserRepository {
  /** `normalizedEmail` is already trimmed and lowercase. */
  existsByEmail(normalizedEmail: string): Promise<boolean>;
}
