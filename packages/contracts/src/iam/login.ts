/** POST /api/v1/auth/login (TS-IAM-002). */
export interface LoginRequest {
  email: string;
  /** Any non-empty value; the password policy is not applied at login. */
  password: string;
}

/** The signed-in user, as returned by login and refresh. */
export interface AuthenticatedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'ACTIVE';
}

/** 200 body. The refresh token is only ever delivered as an HttpOnly cookie. */
export interface LoginResponse {
  user: AuthenticatedUser;
  authentication: {
    accessToken: string;
  };
}

/**
 * POST /api/v1/auth/refresh (TS-IAM-002): no body, the refresh token is read from its cookie.
 * The 200 body has the same shape as the login one, so a reloaded page knows who is signed in.
 */
export type RefreshResponse = LoginResponse;
