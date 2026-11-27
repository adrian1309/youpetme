import { LogOut, Menu, PawPrint, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useNavigate } from 'react-router';

import { primaryButtonClass, secondaryButtonClass } from '../components/Button';
import { useAuth } from '../features/iam/auth/auth-state';
import { APP_NAME } from '../lib/app-name';

/** Navigation links: no underline; a pill on hover and on the current route (SCRUM-56). */
const navLinkClass =
  'flex min-h-11 items-center rounded-pill px-4 text-lg font-semibold text-text hover:bg-accent-soft hover:text-on-accent-soft aria-[current=page]:bg-accent-soft aria-[current=page]:text-on-accent-soft';

/**
 * Site header: brand, main navigation and, once signed in, the greeting and the logout action,
 * so it is available from every view (TS-IAM-003). On small screens the navigation folds behind
 * a menu button. The profile entry is added with its story (SCRUM-9).
 */
export function AppHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const closeMenu = () => setMenuOpen(false);

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
    <header className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex min-h-19 w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          to="/"
          onClick={closeMenu}
          className="flex min-h-11 items-center gap-2 rounded-pill text-2xl font-bold text-brand-primary"
        >
          <PawPrint aria-hidden="true" className="size-7" />
          {APP_NAME}
        </Link>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
          className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-pill text-text hover:bg-accent-soft md:hidden"
        >
          {menuOpen ? (
            <X aria-hidden="true" className="size-6" />
          ) : (
            <Menu aria-hidden="true" className="size-6" />
          )}
          <span className="sr-only">{t('header.menu')}</span>
        </button>
        <div
          id={menuId}
          className={`${menuOpen ? 'flex' : 'hidden'} w-full flex-col gap-3 pb-2 md:flex md:w-auto md:flex-1 md:flex-row md:items-center md:justify-between md:pb-0`}
        >
          <nav aria-label={t('header.primaryNav')}>
            <ul className="flex flex-col gap-1 md:flex-row md:items-center">
              <li>
                <NavLink to="/animals" onClick={closeMenu} className={navLinkClass}>
                  {t('header.catalogue')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/matching" onClick={closeMenu} className={navLinkClass}>
                  {t('header.matching')}
                </NavLink>
              </li>
              {session?.user.role === 'ADMIN' ? (
                <li>
                  <NavLink
                    to="/admin/adoption-requests"
                    onClick={closeMenu}
                    className={navLinkClass}
                  >
                    {t('header.adoptionRequests')}
                  </NavLink>
                </li>
              ) : null}
            </ul>
          </nav>
          {session ? (
            <div className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-pill bg-accent-warm text-lg font-bold text-on-accent-warm"
              >
                {session.user.firstName.charAt(0).toUpperCase()}
              </span>
              <p className="text-base text-text">
                {t('home.greeting', { name: session.user.firstName })}
              </p>
              <button
                type="button"
                onClick={() => void onSignOut()}
                aria-disabled={signingOut || undefined}
                aria-busy={signingOut || undefined}
                className={secondaryButtonClass}
              >
                <LogOut aria-hidden="true" className="size-5" />
                {signingOut ? t('header.signingOut') : t('header.signOut')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/login" onClick={closeMenu} className={secondaryButtonClass}>
                {t('header.signIn')}
              </Link>
              <Link to="/register" onClick={closeMenu} className={primaryButtonClass}>
                {t('header.register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
