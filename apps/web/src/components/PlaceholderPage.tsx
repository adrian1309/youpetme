import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PageTitle } from './PageTitle';

/**
 * Stand-in for a page that a later story builds (Terms and Privacy: SCRUM-47, Login: SCRUM-6),
 * so links to it work today. Replace the route's element when the real page exists.
 */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  const title = t(titleKey);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <PageTitle title={title} />
      <h1 className="mb-4 text-3xl font-bold text-text">{title}</h1>
      <p className="mb-6 text-base text-text">{t('placeholder.body')}</p>
      <Link to="/" className="font-medium text-brand-primary underline">
        {t('placeholder.back')}
      </Link>
    </div>
  );
}
