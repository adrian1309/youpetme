export interface RegisterUserResult {
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
