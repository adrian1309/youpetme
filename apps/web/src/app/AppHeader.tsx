import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useAuth } from '../features/iam/auth/auth-state';
import { APP_NAME } from '../lib/app-name';

/**
 * Minimal header: the brand and, once signed in, the greeting. Profile and sign-out entries are
 * added here when their stories (SCRUM-9 and the logout story) provide the routes.
 */
export function AppHeader() {
  const { t } = useTranslation();
  const { session } = useAuth();

  return (
    <header className="border-b border-border-input bg-surface-muted">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-xl font-bold text-brand-primary">
          {APP_NAME}
        </Link>
        {session ? (
          <p className="text-base text-text">
            {t('home.greeting', { name: session.user.firstName })}
          </p>
        ) : null}
      </div>
    </header>
  );
}
