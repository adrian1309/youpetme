import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router';

import { Notice } from '../../../components/Notice';
import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../auth/auth-state';
import { LoginForm } from './LoginForm';
import { returnPath } from './return-path';

const TITLE_ID = 'login-title';

/**
 * `/login` (TS-IAM-002). Someone already signed in goes to the home instead, or back to the page
 * that sent them here (`state.from`).
 */
export function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  // Set by /reset-password after a successful reset (TS-IAM-004, D9).
  const passwordReset =
    (location.state as { passwordReset?: unknown } | null)?.passwordReset === true;

  const target = returnPath(location.state);

  if (isAuthenticated) {
    return <Navigate to={target} replace />;
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <PageTitle title={t('login.title')} />
      <h1 id={TITLE_ID} className="mb-6 text-3xl font-bold text-text">
        {t('login.title')}
      </h1>
      {passwordReset ? (
        <div className="mb-6">
          <Notice focusOnMount>{t('login.passwordReset')}</Notice>
        </div>
      ) : null}
      <LoginForm titleId={TITLE_ID} redirectTo={target} />
      <p className="mt-6 text-base text-text">
        <Link to="/forgot-password" className="font-medium text-brand-primary underline">
          {t('login.forgotPassword')}
        </Link>
      </p>
      <p className="mt-4 text-base text-text">
        {t('login.register.prompt')}{' '}
        <Link to="/register" className="font-medium text-brand-primary underline">
          {t('login.register.link')}
        </Link>
      </p>
    </div>
  );
}
