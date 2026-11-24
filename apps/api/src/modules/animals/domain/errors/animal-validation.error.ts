export interface AnimalValidationIssue {
  readonly field: string;
  readonly code: 'REQUIRED' | 'INVALID_FORMAT' | 'INVALID_TYPE' | 'TOO_LONG';
}

/** One or more animal fields are invalid; carries a stable code per field (ADR-017). */
export class AnimalValidationError extends Error {
  constructor(readonly issues: readonly AnimalValidationIssue[]) {
    super('Validation failed');
    this.name = 'AnimalValidationError';
  }
}
