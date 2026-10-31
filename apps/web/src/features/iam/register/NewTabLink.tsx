import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/**
 * Link that opens in a new tab so the half-filled form is not lost, and says so to screen
 * readers (WCAG 3.2.5 / G201).
 */
export function NewTabLink({ to, children }: { to: string; children?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Link
      to={to}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand-primary underline"
    >
      {children}
      <span className="sr-only"> {t('register.fields.terms.opensInNewTab')}</span>
    </Link>
  );
}
