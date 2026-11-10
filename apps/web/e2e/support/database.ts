import { psql } from './compose.ts';

/**
 * State the UI cannot produce yet (no admin suspension, no logout): written straight into the
 * isolated E2E database (Compose project youpetme-e2e, never the development one). Every statement
 * is filtered by the test's own unique email, so parallel tests never touch each other's rows.
 * The email is passed as a psql variable, never concatenated into the SQL.
 */
const SESSIONS_OF_USER = "user_id = (SELECT id FROM users WHERE email = :'email')";

export function suspendAccount(email: string): void {
  psql(`UPDATE users SET status = 'SUSPENDED' WHERE email = :'email';`, { email });
}

/** What logout or a password change will do (TS-IAM-003, TS-IAM-004). */
export function revokeSessions(email: string): void {
  psql(`UPDATE user_sessions SET status = 'REVOKED' WHERE ${SESSIONS_OF_USER};`, { email });
}

/** Moves the expiry of the user's sessions into the past, as if a week had gone by. */
export function expireSessions(email: string): void {
  psql(
    `UPDATE user_sessions SET expires_at = now() - interval '1 minute' WHERE ${SESSIONS_OF_USER};`,
    { email },
  );
}

/**
 * Moves the creation of the user's sessions `days` into the past, as if they had signed in back
 * then, while their sliding expiry stays in the future (SCRUM-54, absolute session lifetime).
 */
export function ageSessions(email: string, days: number): void {
  psql(
    `UPDATE user_sessions SET created_at = now() - make_interval(days => :'days'::int) WHERE ${SESSIONS_OF_USER};`,
    { email, days: String(days) },
  );
}

/** The status of each of the user's sessions, oldest first. */
export function sessionStatuses(email: string): string[] {
  return psql(`SELECT status FROM user_sessions WHERE ${SESSIONS_OF_USER} ORDER BY created_at;`, {
    email,
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
