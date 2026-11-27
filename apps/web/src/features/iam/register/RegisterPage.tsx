import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';

import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../auth/auth-state';
import { RegisterForm } from './RegisterForm';
import { AuthCard } from '../../../components/AuthCard';

const TITLE_ID = 'register-title';

export function RegisterPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthCard titleId={TITLE_ID} title={t('register.title')} intro={t('register.intro')}>
      <PageTitle title={t('register.title')} />
      <RegisterForm titleId={TITLE_ID} />
      <p className="mt-6 text-base text-text">
        {t('register.login.prompt')}{' '}
        <Link to="/login" className="font-bold text-brand-primary">
          {t('register.login.link')}
        </Link>
      </p>
    </AuthCard>
  );
}
