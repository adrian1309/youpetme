import { buildPasswordResetEmail } from './password-reset-email';

const link = 'http://localhost:5173/reset-password?token=abc_DEF-123';

describe('buildPasswordResetEmail (TS-IAM-004)', () => {
  it('addresses the account email with a Spanish subject', () => {
    const email = buildPasswordResetEmail({ to: 'john@example.com', link, ttlMs: 7_200_000 });

    expect(email.to).toBe('john@example.com');
    expect(email.subject).toBe('Restablece tu contraseña de YouPetMe');
  });

  it('carries the link, its lifetime and single use in both text and HTML', () => {
    const email = buildPasswordResetEmail({ to: 'john@example.com', link, ttlMs: 7_200_000 });

    for (const body of [email.text, email.html]) {
      expect(body).toContain(link);
      expect(body).toContain('2 horas');
      expect(body).toContain('una vez');
    }
    expect(email.html).toContain(`href="${link}"`);
  });

  it.each([
    [60 * 60 * 1000, '1 hora'],
    [30 * 60 * 1000, '30 minutos'],
    [60 * 1000, '1 minuto'],
  ])('writes a lifetime of %i ms as "%s"', (ttlMs, words) => {
    expect(buildPasswordResetEmail({ to: 'a@example.com', link, ttlMs }).text).toContain(words);
  });

  it('escapes the link inside the HTML', () => {
    const email = buildPasswordResetEmail({
      to: 'a@example.com',
      link: 'http://localhost:5173/reset-password?token=a&b="c"',
      ttlMs: 7_200_000,
    });

    expect(email.html).toContain('token=a&amp;b=&quot;c&quot;');
    expect(email.html).not.toContain('"c"');
  });
});
