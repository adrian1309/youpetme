import { RandomResetTokenGenerator } from './random-reset-token-generator';

describe('RandomResetTokenGenerator', () => {
  const generator = new RandomResetTokenGenerator();

  it('returns 256 random bits as URL-safe base64, with no padding', () => {
    const token = generator.generate();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generator.generate()));

    expect(tokens.size).toBe(1000);
  });
});
