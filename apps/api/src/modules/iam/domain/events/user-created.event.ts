/** Published after a registration has been committed. Never carries secrets, hashes or tokens. */
export class UserCreated {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly occurredAt: Date,
    readonly correlationId?: string,
  ) {}
}

export type DomainEvent = UserCreated;
