import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, 'global.css'), 'utf8');

/** Semantic colour tokens declared in the Tailwind @theme block (Design System — tokens). */
function tokens(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    result[match[1]!] = match[2]!;
  }
  return result;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('design tokens (WCAG 2.1 AA, provisional palette)', () => {
  const colors = tokens();

  it('declares the semantic colour tokens the registration UI uses', () => {
    for (const name of [
      'surface',
      'surface-muted',
      'text',
      'text-muted',
      'border-input',
      'brand-primary',
      'brand-primary-hover',
      'on-brand',
      'feedback-error',
      'feedback-success',
    ]) {
      expect(colors, name).toHaveProperty(name);
    }
  });

  it.each([
    ['text', 'surface'],
    ['text', 'surface-muted'],
    ['text-muted', 'surface'],
    ['text-muted', 'surface-muted'],
    ['on-brand', 'brand-primary'],
    ['on-brand', 'brand-primary-hover'],
    ['feedback-error', 'surface'],
    ['feedback-error', 'surface-muted'],
    ['feedback-success', 'surface'],
    ['brand-primary', 'surface'],
  ])('text %s on %s has at least 4.5:1 contrast', (foreground, background) => {
    expect(contrast(colors[foreground]!, colors[background]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['border-input', 'surface'],
    ['brand-primary', 'surface'],
  ])('non-text %s against %s has at least 3:1 contrast (inputs, focus ring)', (a, b) => {
    expect(contrast(colors[a]!, colors[b]!)).toBeGreaterThanOrEqual(3);
  });
});
