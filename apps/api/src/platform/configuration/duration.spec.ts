import { parseDurationMs } from './duration';

describe('parseDurationMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
  ])('parses %s', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected);
  });

  it.each(['', '15', 'm', '0m', '-5m', '1.5h', '7 d', '7w', '15M'])('rejects %p', (input) => {
    expect(() => parseDurationMs(input)).toThrow(/duration/i);
  });
});
