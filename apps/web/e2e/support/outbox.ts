import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from '@playwright/test';

import { EMAIL_OUTBOX_DIR } from './env.ts';

/** One email as the API's file adapter writes it (`<uuid>.json`, written atomically). */
interface CapturedEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Every email sent to `email` so far. Tests use unique addresses, so they never mix. */
export function emailsTo(email: string): CapturedEmail[] {
  let names: string[];
  try {
    names = readdirSync(EMAIL_OUTBOX_DIR).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  return names
    .map((name) => JSON.parse(readFileSync(join(EMAIL_OUTBOX_DIR, name), 'utf8')) as CapturedEmail)
    .filter((captured) => captured.to === email);
}

const RESET_LINK = /https?:\/\/[^\s]+\/reset-password\?token=[A-Za-z0-9_-]+/;

/**
 * Waits for the password reset email to `email` and returns its link. The API sends it after
 * answering the request, so it may arrive a moment later.
 */
export async function waitForResetLink(email: string): Promise<string> {
  await expect
    .poll(() => emailsTo(email).length, { message: `reset email to ${email}`, timeout: 10_000 })
    .toBeGreaterThan(0);
  const [captured] = emailsTo(email);
  const link = RESET_LINK.exec(captured!.text)?.[0];
  if (!link) throw new Error('The reset email has no reset link');
  return link;
}
