/** What a use case returns when it leaves the user signed in (register, login, refresh). */
export interface AuthenticatedSessionResult {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
  accessToken: string;
  /** Delivered to the client only as an HttpOnly cookie, never in the response body. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}
