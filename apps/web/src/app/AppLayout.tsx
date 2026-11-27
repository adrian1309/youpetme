import { PawPrint } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router';

import { Diango } from '../features/assistant/Diango';
import { useAuth } from '../features/iam/auth/auth-state';
import { APP_NAME } from '../lib/app-name';
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
      {/* overflow-x-clip: decorative shapes never cause horizontal scroll (SCRUM-56). */}
      <div className="flex min-h-screen flex-col overflow-x-clip">
        <AppHeader />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1">
          {status === 'restoring' ? (
            <p role="status" className="mx-auto w-full max-w-xl px-4 py-8 text-base text-text">
              {t('session.restoring')}
            </p>
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="border-t border-border-subtle bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-6 text-base text-text-muted sm:px-6">
            <span className="flex items-center gap-2 font-bold text-text">
              <PawPrint aria-hidden="true" className="size-5 text-brand-primary" />
              {APP_NAME}
            </span>
            <span>{t('footer.tagline')}</span>
          </div>
        </footer>
      </div>
      {/* On every page, outside the main landmark; it waits for the session restore (SCRUM-17). */}
      <Diango />
    </>
  );
}
