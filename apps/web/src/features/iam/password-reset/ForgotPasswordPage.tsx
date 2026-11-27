import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';

import { Notice } from '../../../components/Notice';
import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../auth/auth-state';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { AuthCard } from '../../../components/AuthCard';

const TITLE_ID = 'forgot-password-title';

/**
 * `/forgot-password` (TS-IAM-004). The confirmation is the same whatever the account, so it never
 * reveals whether an email is registered. Someone already signed in goes to the home (D6).
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [sent, setSent] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthCard titleId={TITLE_ID} title={t('forgotPassword.title')}>
      <PageTitle title={t('forgotPassword.title')} />
      {sent ? (
        <Notice focusOnMount>{t('forgotPassword.sent')}</Notice>
      ) : (
        <>
          <p className="mb-6 text-base text-text">{t('forgotPassword.intro')}</p>
          <ForgotPasswordForm titleId={TITLE_ID} onSent={() => setSent(true)} />
        </>
      )}
      <p className="mt-6 text-base text-text">
        <Link to="/login" className="font-bold text-brand-primary">
          {t('forgotPassword.backToLogin')}
        </Link>
      </p>
    </AuthCard>
  );
}
