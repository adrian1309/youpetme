import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { AppHeader } from './AppHeader';

/** Page frame: skip link, header and the main landmark every route renders into. */
export function AppLayout() {
  const { t } = useTranslation();

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-text"
      >
        {t('common.skipToContent')}
      </a>
      <AppHeader />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
