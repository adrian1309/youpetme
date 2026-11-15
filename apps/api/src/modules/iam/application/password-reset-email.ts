import type { EmailMessage } from '../../notifications/domain/ports/email-sender';

export interface PasswordResetEmailInput {
  to: string;
  /** Full link to the web app's reset page, token included. */
  link: string;
  /** Lifetime of the link, to tell the user how long it works. */
  ttlMs: number;
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function lifetimeInWords(ttlMs: number): string {
  if (ttlMs % HOUR_MS === 0) return plural(ttlMs / HOUR_MS, 'hora', 'horas');
  return plural(Math.round(ttlMs / MINUTE_MS), 'minuto', 'minutos');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** The password reset email (TS-IAM-004), in Spanish, as plain text and minimal HTML. */
export function buildPasswordResetEmail({
  to,
  link,
  ttlMs,
}: PasswordResetEmailInput): EmailMessage {
  const lifetime = lifetimeInWords(ttlMs);
  const paragraphs = [
    'Hola:',
    'Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de YouPetMe. Para crear una contraseña nueva, abre este enlace:',
    link,
    `El enlace caduca en ${lifetime} y solo se puede usar una vez. Si pides otro, este dejará de funcionar.`,
    'Si no has sido tú, ignora este correo: tu contraseña no cambiará.',
  ];
  const safeLink = escapeHtml(link);
  const html = paragraphs
    .map((paragraph) =>
      paragraph === link
        ? `<p><a href="${safeLink}">${safeLink}</a></p>`
        : `<p>${escapeHtml(paragraph)}</p>`,
    )
    .join('\n');
  return {
    to,
    subject: 'Restablece tu contraseña de YouPetMe',
    text: paragraphs.join('\n\n'),
    html,
  };
}
