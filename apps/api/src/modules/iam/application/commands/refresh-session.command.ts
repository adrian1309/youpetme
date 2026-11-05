export interface RefreshSessionCommand {
  /** Value of the refresh-token cookie; undefined when the request carried none. */
  refreshToken: string | undefined;
}
