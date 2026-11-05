/** Published after a successful login (TS-IAM-002). Never carries secrets, hashes or tokens. */
export class UserLoggedIn {
  constructor(
    readonly userId: string,
    readonly occurredAt: Date,
    readonly correlationId?: string,
  ) {}
}
