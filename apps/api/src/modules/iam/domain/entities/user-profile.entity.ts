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

  static validateNames(firstName: string, lastName: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (firstName.trim().length === 0) issues.push({ field: 'firstName', code: 'REQUIRED' });
    if (lastName.trim().length === 0) issues.push({ field: 'lastName', code: 'REQUIRED' });
    return issues;
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
