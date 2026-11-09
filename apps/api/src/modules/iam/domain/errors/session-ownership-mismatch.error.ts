/**
 * The refresh cookie presented at logout names a session of another user than the access token
 * (TS-IAM-003, decision L1). Nothing is revoked; the request is treated as not authenticated.
 */
export class SessionOwnershipMismatchError extends Error {
  constructor() {
    super('Session ownership mismatch');
    this.name = 'SessionOwnershipMismatchError';
  }
}
