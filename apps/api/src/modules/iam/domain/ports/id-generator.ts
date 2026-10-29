export interface IdGenerator {
  /** A new UUID. */
  next(): string;
}
