import { ValidationFailedError, type ValidationIssue } from '../errors/validation-failed.error';

export interface CreateUserProfileProps {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  hasSeenWelcome?: boolean;
  now: Date;
}

export class UserProfile {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly firstName: string,
    readonly lastName: string,
    readonly hasSeenWelcome: boolean,
    readonly matchingPreferences: null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  /** Maximum characters of a first or last name once trimmed (TS-IAM-001). */
  static readonly NAME_MAX_LENGTH = 100;

  static validateNames(firstName: string, lastName: string): ValidationIssue[] {
    return [
      ...UserProfile.validateName('firstName', firstName),
      ...UserProfile.validateName('lastName', lastName),
    ];
  }

  private static validateName(field: string, value: string): ValidationIssue[] {
    const trimmed = value.trim();
    if (trimmed.length === 0) return [{ field, code: 'REQUIRED' }];
    // Count characters (code points), as PostgreSQL's char_length does.
    if ([...trimmed].length > UserProfile.NAME_MAX_LENGTH) return [{ field, code: 'TOO_LONG' }];
    return [];
  }

  /** A new profile has no matching preferences; they are only filled in later (ADR-010). */
  static create(props: CreateUserProfileProps): UserProfile {
    const issues = UserProfile.validateNames(props.firstName, props.lastName);
    if (issues.length > 0) {
      throw new ValidationFailedError(issues);
    }
    return new UserProfile(
      props.id,
      props.userId,
      props.firstName.trim(),
      props.lastName.trim(),
      props.hasSeenWelcome ?? false,
      null,
      props.now,
      props.now,
    );
  }
}
