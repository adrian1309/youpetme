/** Published after a logout has revoked a session (TS-IAM-003). Never carries secrets or tokens. */
export class SessionRevoked {
  constructor(
    readonly sessionId: string,
    readonly userId: string,
    readonly occurredAt: Date,
  ) {}
}
