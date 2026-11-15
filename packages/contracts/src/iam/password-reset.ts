/** POST /api/v1/auth/password-reset/request (TS-IAM-004). */
export interface PasswordResetRequest {
  email: string;
}

/**
 * 202 body. Always the same, whether or not an account exists for the email, so the response
 * never reveals which addresses are registered.
 */
export interface PasswordResetRequestedResponse {
  message: string;
}

/** POST /api/v1/auth/password-reset/confirm (TS-IAM-004). */
export interface PasswordResetConfirmRequest {
  /** The token of the emailed link. */
  token: string;
  /** Same policy as registration (PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH). */
  password: string;
  /** Must equal `password`; never persisted. */
  confirmPassword: string;
}

/**
 * 200 body. The user is not signed in: every session has been revoked and the client sends the
 * user to the login page.
 */
export interface PasswordResetConfirmedResponse {
  message: string;
}
