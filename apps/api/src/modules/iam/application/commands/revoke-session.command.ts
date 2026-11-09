export interface RevokeSessionCommand {
  /** The user authenticated by the access token. */
  userId: string;
  /** Value of the refresh-token cookie; it names the session to close. Undefined when absent. */
  refreshToken: string | undefined;
}
