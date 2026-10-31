import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';

import { useAuth } from '../auth/auth-state';
import { RegisterForm } from './RegisterForm';

const TITLE_ID = 'register-title';

export function RegisterPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 id={TITLE_ID} className="mb-6 text-3xl font-bold text-text">
        {t('register.title')}
      </h1>
      <RegisterForm titleId={TITLE_ID} />
      <p className="mt-6 text-base text-text">
        {t('register.login.prompt')}{' '}
        <Link to="/login" className="font-medium text-brand-primary underline">
          {t('register.login.link')}
        </Link>
      </p>
    </div>
  );
}
