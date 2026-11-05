/**
 * The refresh token is missing, invalid, expired or already rotated, or its session is no longer
 * ACTIVE. One error for every case: the client only needs to know it is signed out again.
 */
export class SessionNotRenewableError extends Error {
  constructor() {
    super('Session not renewable');
    this.name = 'SessionNotRenewableError';
  }
}
