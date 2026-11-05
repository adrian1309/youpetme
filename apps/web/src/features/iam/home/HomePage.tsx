import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PageTitle } from '../../../components/PageTitle';
import { APP_NAME } from '../../../lib/app-name';
import { useAuth } from '../auth/auth-state';

/** `/`: the authenticated area for the MVP (SCRUM-20); there is no separate dashboard. */
export function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated, accountCreated } = useAuth();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <PageTitle />
      {isAuthenticated ? (
        <h1 className="text-3xl font-bold text-text">
          {t(accountCreated ? 'home.accountCreated' : 'home.signedIn')}
        </h1>
      ) : (
        <>
          <h1 className="mb-6 text-3xl font-bold text-text">{APP_NAME}</h1>
          <p className="flex flex-wrap gap-6">
            <Link to="/register" className="font-medium text-brand-primary underline">
              {t('home.visitor.register')}
            </Link>
            <Link to="/login" className="font-medium text-brand-primary underline">
              {t('home.visitor.login')}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
