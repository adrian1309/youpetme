import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router';

import { useAuth } from '../features/iam/auth/auth-state';
import { AppHeader } from './AppHeader';

/**
 * Page frame: skip link, header and the main landmark every route renders into. While the
 * session is being restored on start-up the page is held back, so a signed-in user never sees a
 * visitor page (or the login form) flash before the redirect (TS-IAM-002).
 */
export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, expired, acknowledgeExpiry } = useAuth();

  useEffect(() => {
    if (!expired) return;
    acknowledgeExpiry();
    void navigate('/login', { replace: true });
  }, [expired, acknowledgeExpiry, navigate]);

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
        {status === 'restoring' ? (
          <p role="status" className="mx-auto w-full max-w-xl px-4 py-8 text-base text-text">
            {t('session.restoring')}
          </p>
        ) : (
          <Outlet />
        )}
      </main>
    </>
  );
}
