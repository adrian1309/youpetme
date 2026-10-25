const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** Parses the compact durations used in configuration (e.g. `15m`, `7d`) into milliseconds. */
export function parseDurationMs(value: string): number {
  const match = /^([1-9]\d*)([smhd])$/.exec(value);
  if (!match) {
    throw new Error(`Invalid duration "${value}": expected a positive integer plus s, m, h or d`);
  }
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}
