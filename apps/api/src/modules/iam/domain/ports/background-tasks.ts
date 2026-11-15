/**
 * Runs work after the current request without making it wait (TS-IAM-004: the reset email is
 * sent once the response is on its way, so response times do not reveal whether an account
 * exists). A failed task is logged and never reaches the caller. Not for work that must not be
 * lost: a task in flight is lost if the process stops.
 */
export interface BackgroundTasks {
  run(description: string, task: () => Promise<void>): void;
}
