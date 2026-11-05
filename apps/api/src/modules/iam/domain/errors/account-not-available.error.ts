/** The credentials are right but the account is not ACTIVE; the exact status is not disclosed. */
export class AccountNotAvailableError extends Error {
  constructor() {
    super('Account not available');
    this.name = 'AccountNotAvailableError';
  }
}
