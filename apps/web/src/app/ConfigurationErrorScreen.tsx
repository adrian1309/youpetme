import { useTranslation } from 'react-i18next';

import { PageTitle } from '../components/PageTitle';

/**
 * Shown instead of a blank page when the build is misconfigured (e.g. VITE_API_URL missing in
 * production). It needs no providers or router, and never shows the technical reason: that goes
 * to the console for whoever deploys the app.
 */
export function ConfigurationErrorScreen() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <PageTitle title={t('configuration.error.title')} />
      <h1 className="mb-4 text-3xl font-bold text-text">{t('configuration.error.title')}</h1>
      <p role="alert" className="text-base text-text">
        {t('configuration.error.body')}
      </p>
    </main>
  );
}
