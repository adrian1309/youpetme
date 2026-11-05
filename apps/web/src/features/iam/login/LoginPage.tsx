import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';

import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../auth/auth-state';
import { LoginForm } from './LoginForm';

const TITLE_ID = 'login-title';

/** `/login` (TS-IAM-002). Someone already signed in goes to the home instead. */
export function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <PageTitle title={t('login.title')} />
      <h1 id={TITLE_ID} className="mb-6 text-3xl font-bold text-text">
        {t('login.title')}
      </h1>
      <LoginForm titleId={TITLE_ID} />
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
