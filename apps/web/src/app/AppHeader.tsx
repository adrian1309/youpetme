import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '../features/iam/auth/auth-state';
import { APP_NAME } from '../lib/app-name';

/**
 * Minimal header: the brand and, once signed in, the greeting and the logout action, so it is
 * available from every view (TS-IAM-003). The profile entry is added with its story (SCRUM-9).
 */
export function AppHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      // Decision L6: back to the public home, which offers to sign in again.
      void navigate('/', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="border-b border-border-input bg-surface-muted">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-xl font-bold text-brand-primary">
          {APP_NAME}
        </Link>
        {session ? (
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-base text-text">
              {t('home.greeting', { name: session.user.firstName })}
            </p>
            <button
              type="button"
              onClick={() => void onSignOut()}
              aria-disabled={signingOut || undefined}
              aria-busy={signingOut || undefined}
              className="min-h-11 rounded-control border-2 border-brand-primary px-4 py-2 text-base font-semibold text-brand-primary hover:bg-surface aria-disabled:cursor-wait aria-disabled:opacity-80"
            >
              {signingOut ? t('header.signingOut') : t('header.signOut')}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
