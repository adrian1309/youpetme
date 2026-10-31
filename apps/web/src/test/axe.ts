import axe from 'axe-core';

/**
 * Runs axe-core on rendered markup (WCAG 2.1 A/AA rules). jsdom cannot compute layout or
 * colours, so contrast is covered by tokens.spec.ts instead; `region` only makes sense for whole
 * pages and is switched on explicitly by page-level tests.
 */
export async function expectNoAxeViolations(
  container: Element,
  options: { page?: boolean } = {},
): Promise<void> {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: options.page === true },
    },
  });
  const messages = results.violations.map(
    (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s))`,
  );
  expect(messages).toEqual([]);
}
