import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router';

import { Notice } from '../../../components/Notice';
import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../auth/auth-state';
import { LoginForm } from './LoginForm';
import { returnPath } from './return-path';
import { AuthCard } from '../../../components/AuthCard';

const TITLE_ID = 'login-title';

/**
 * `/login` (TS-IAM-002). Someone already signed in goes to the home instead, or back to the page
 * that sent them here (`state.from`).
 */
export function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, session } = useAuth();
  const location = useLocation();
  // Set by /reset-password after a successful reset (TS-IAM-004, D9).
  const passwordReset =
    (location.state as { passwordReset?: unknown } | null)?.passwordReset === true;

  const target = returnPath(location.state, session?.user.role);

  if (isAuthenticated) {
    return <Navigate to={target} replace />;
  }

  return (
    <AuthCard titleId={TITLE_ID} title={t('login.title')} intro={t('login.intro')}>
      <PageTitle title={t('login.title')} />
      {passwordReset ? (
        <div className="mb-6">
          <Notice focusOnMount>{t('login.passwordReset')}</Notice>
        </div>
      ) : null}
      <LoginForm titleId={TITLE_ID} returnState={location.state} />
      <p className="mt-6 text-base text-text">
        <Link to="/forgot-password" className="font-bold text-brand-primary">
          {t('login.forgotPassword')}
        </Link>
      </p>
      <p className="mt-4 text-base text-text">
        {t('login.register.prompt')}{' '}
        <Link to="/register" className="font-bold text-brand-primary">
          {t('login.register.link')}
        </Link>
      </p>
    </AuthCard>
  );
}
