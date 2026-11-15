import { ConsoleEmailSender } from './console-email-sender';

describe('ConsoleEmailSender', () => {
  it('prints the whole email, link included, instead of sending it (development only)', async () => {
    const lines: string[] = [];
    const sender = new ConsoleEmailSender({ log: (line: string) => lines.push(line) });

    await sender.send({
      to: 'john@example.com',
      subject: 'Reset your password',
      text: 'Open https://app.example/reset-password?token=abc',
      html: '<p>ignored</p>',
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('To: john@example.com');
    expect(lines[0]).toContain('Subject: Reset your password');
    expect(lines[0]).toContain('https://app.example/reset-password?token=abc');
    expect(lines[0]).not.toContain('<p>');
  });
});
