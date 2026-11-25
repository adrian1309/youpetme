export interface AdoptionValidationIssue {
  readonly field: string;
  readonly code: 'REQUIRED' | 'INVALID_FORMAT' | 'INVALID_TYPE' | 'TOO_LONG';
}

/** One or more fields are invalid (400 with details, ADR-017). */
export class AdoptionValidationError extends Error {
  constructor(readonly issues: readonly AdoptionValidationIssue[]) {
    super('Validation failed');
    this.name = 'AdoptionValidationError';
  }
}

/** The animal does not exist (404). */
export class AdoptionAnimalNotFoundError extends Error {
  constructor() {
    super('Animal not found');
    this.name = 'AdoptionAnimalNotFoundError';
  }
}

/** The adoption request does not exist (404). */
export class AdoptionRequestNotFoundError extends Error {
  constructor() {
    super('Adoption request not found');
    this.name = 'AdoptionRequestNotFoundError';
  }
}

/** The animal is not AVAILABLE, when requesting or approving (409 ANIMAL_NOT_AVAILABLE). */
export class AnimalNotAvailableError extends Error {
  constructor() {
    super('Animal not available');
    this.name = 'AnimalNotAvailableError';
  }
}

/** The user already has a PENDING or APPROVED request for the animal (409 ADOPTION_REQUEST_ACTIVE). */
export class AdoptionRequestActiveError extends Error {
  constructor() {
    super('Adoption request already active');
    this.name = 'AdoptionRequestActiveError';
  }
}

/**
 * The action is not allowed from the request's status, or the request or its animal changed
 * meanwhile (another admin). 409 without code.
 */
export class TransitionNotAllowedError extends Error {
  constructor() {
    super('Transition not allowed');
    this.name = 'TransitionNotAllowedError';
  }
}
