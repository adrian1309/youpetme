import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';

import { Notice } from '../../../components/Notice';
import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../auth/auth-state';
import { ForgotPasswordForm } from './ForgotPasswordForm';

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
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <PageTitle title={t('forgotPassword.title')} />
      <h1 id={TITLE_ID} className="mb-4 text-3xl font-bold text-text">
        {t('forgotPassword.title')}
      </h1>
      {sent ? (
        <Notice focusOnMount>{t('forgotPassword.sent')}</Notice>
      ) : (
        <>
          <p className="mb-6 text-base text-text">{t('forgotPassword.intro')}</p>
          <ForgotPasswordForm titleId={TITLE_ID} onSent={() => setSent(true)} />
        </>
      )}
      <p className="mt-6 text-base text-text">
        <Link to="/login" className="font-medium text-brand-primary underline">
          {t('forgotPassword.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
