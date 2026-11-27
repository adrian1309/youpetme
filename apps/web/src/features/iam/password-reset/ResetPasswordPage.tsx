import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../auth/auth-state';
import { ResetPasswordForm } from './ResetPasswordForm';

const TITLE_ID = 'reset-password-title';

/** Where the token lives once the page has loaded (D8): history state, never the address bar. */
interface ResetPasswordState {
  token?: unknown;
}

/**
 * `/reset-password?token=…` (TS-IAM-004). On load the token leaves the address bar for history
 * state, so it is neither shown, nor kept in the visible history, nor sent as a Referer, and it
 * survives a reload. After the reset nobody is signed in (D9): a signed-in user is signed out,
 * since every session was revoked (D6), and everyone lands on /login.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();
  const [linkInvalid, setLinkInvalid] = useState(false);

  const fromQuery = new URLSearchParams(location.search).get('token');
  const fromState = (location.state as ResetPasswordState | null)?.token;
  const token = fromQuery || (typeof fromState === 'string' ? fromState : null);

  useEffect(() => {
    if (fromQuery) {
      void navigate(location.pathname, { replace: true, state: { token: fromQuery } });
    }
  }, [fromQuery, location.pathname, navigate]);

  async function done() {
    if (isAuthenticated) await signOut();
    void navigate('/login', { replace: true, state: { passwordReset: true } });
  }

  const title = t(
    !token || linkInvalid ? 'resetPassword.invalidLink.title' : 'resetPassword.title',
  );

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <PageTitle title={title} />
      <meta name="referrer" content="no-referrer" />
      <h1 id={TITLE_ID} className="mb-4 text-3xl font-bold text-text">
        {title}
      </h1>
      {!token || linkInvalid ? (
        <>
          <p className="mb-6 text-base text-text">{t('resetPassword.invalidLink.body')}</p>
          <p className="text-base text-text">
            <Link to="/forgot-password" className="font-bold text-brand-primary">
              {t('resetPassword.invalidLink.requestNew')}
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mb-6 text-base text-text">{t('resetPassword.intro')}</p>
          <ResetPasswordForm
            titleId={TITLE_ID}
            token={token}
            onDone={done}
            onLinkInvalid={() => setLinkInvalid(true)}
          />
        </>
      )}
    </div>
  );
}
