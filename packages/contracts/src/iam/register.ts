/** Password length bounds of ADR-002; the API is the source of truth, clients mirror them. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** POST /api/v1/auth/register (TS-IAM-001). */
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  /** Must be true; the accepted version is decided by the server, never sent by the client. */
  termsAccepted: boolean;
  /** True when the guest already saw Diango's welcome (localStorage); defaults to false. */
  hasSeenWelcome?: boolean;
}

/** 201 body. The refresh token is only ever delivered as an HttpOnly cookie. */
export interface RegisterResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: 'ACTIVE';
  };
  authentication: {
    accessToken: string;
  };
}
