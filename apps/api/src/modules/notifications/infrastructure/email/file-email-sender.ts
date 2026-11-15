import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { EmailMessage, EmailSender } from '../../domain/ports/email-sender';

/**
 * Automated-test adapter (ADR-014): writes each email to `<outboxDir>/<uuid>.json` so an E2E test
 * can read the reset link. Written under a temporary name and renamed, so a reader never sees a
 * partial file. The configuration refuses it in production.
 */
export class FileEmailSender implements EmailSender {
  constructor(private readonly outboxDir: string) {}

  async send(message: EmailMessage): Promise<void> {
    await mkdir(this.outboxDir, { recursive: true });
    const id = randomUUID();
    const temporary = join(this.outboxDir, `${id}.tmp`);
    const { to, subject, text, html } = message;
    await writeFile(temporary, JSON.stringify({ to, subject, text, html }), 'utf8');
    await rename(temporary, join(this.outboxDir, `${id}.json`));
  }
}
