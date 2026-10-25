export interface ValidationIssue {
  readonly field: string;
  readonly code: string;
}

/** One or more input fields violate a business rule; carries a stable code per field. */
export class ValidationFailedError extends Error {
  constructor(readonly issues: readonly ValidationIssue[]) {
    super('Validation failed');
    this.name = 'ValidationFailedError';
  }
}
