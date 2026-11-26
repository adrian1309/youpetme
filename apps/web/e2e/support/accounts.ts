import { randomUUID } from 'node:crypto';

import { API_URL } from './env.ts';

/** Authentication endpoints of the API under test (TS-IAM-001, TS-IAM-002). */
export const REGISTER_ENDPOINT = `${API_URL}/api/v1/auth/register`;
export const LOGIN_ENDPOINT = `${API_URL}/api/v1/auth/login`;
export const REFRESH_ENDPOINT = `${API_URL}/api/v1/auth/refresh`;
export const LOGOUT_ENDPOINT = `${API_URL}/api/v1/auth/logout`;

/** An origin other than WEB_ORIGIN, for the Origin guard. */
export const FOREIGN_ORIGIN = 'https://foreign.example';

/** A visitor nobody has registered yet, so tests never share data. */
export function newVisitor() {
  return {
    firstName: 'Ana',
    lastName: 'García',
    email: `e2e-${randomUUID()}@example.com`,
    password: 'my-secure-passphrase',
  };
}

export type Visitor = ReturnType<typeof newVisitor>;

/**
 * Accounts start as having seen Diango's welcome (SCRUM-17), like the returning guest of the
 * Playwright storageState, so the welcome never covers a journey that is not about it.
 */
export function registerBody(visitor: Visitor) {
  return {
    ...visitor,
    confirmPassword: visitor.password,
    termsAccepted: true,
    hasSeenWelcome: true,
  };
}
