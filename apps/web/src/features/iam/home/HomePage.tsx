import { Heart, LayoutDashboard, PawPrint, Search, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { buttonClass } from '../../../components/button-styles';
import { Notice } from '../../../components/Notice';
import { PageTitle } from '../../../components/PageTitle';
import { AnimalCard } from '../../animals/catalogue/AnimalCard';
import { useAnimals } from '../../animals/catalogue/use-animals';
import { useAuth } from '../auth/auth-state';

/** Animals shown on the home page: the first ones of the catalogue, without filters. */
const FRIENDS = 3;

const iconClass = 'size-6';

/**
 * `/` (SCRUM-20, SCRUM-56): the same full page for everyone (hero, how it works, a few animals
 * and a closing band). Only the hero's text and the actions depend on who is visiting.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { session, accountCreated } = useAuth();
  const isAdmin = session?.user.role === 'ADMIN';
  const actions = isAdmin ? <AdminActions /> : <MainActions />;

  return (
    <>
      <PageTitle />
      {/* Clipped vertically only: the shapes may spill into the page margins, never above or
          below the hero (the layout clips them at the window's edges). */}
      <section className="relative flex min-h-[26rem] items-center justify-center overflow-y-clip px-4 py-20 text-center sm:py-28">
        <Decorations />
        <div className="relative mx-auto max-w-3xl">
          {session && accountCreated ? (
            <div className="mx-auto mb-6 max-w-md text-left">
              <Notice>{t('home.accountCreated')}</Notice>
            </div>
          ) : null}
          <h1 className="mx-auto max-w-2xl text-[2rem] font-semibold leading-tight text-text sm:text-[2.75rem]">
            {session ? t('home.greeting', { name: session.user.firstName }) : t('home.hero.title')}
          </h1>
          {!session ? (
            <p className="mx-auto mt-5 max-w-xl text-lg text-text-muted sm:text-xl">
              {t('home.hero.subtitle')}
            </p>
          ) : !isAdmin ? (
            <p className="mx-auto mt-5 max-w-xl text-lg text-text-muted sm:text-xl">
              {t('home.user.subtitle')}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-center gap-4">{actions}</div>
          {!session ? (
            <p className="mt-6 text-base text-text-muted">
              {t('home.hero.loginPrompt')} <Link to="/login">{t('home.hero.login')}</Link>
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="home-how" className="px-4 py-12">
        <h2 id="home-how" className="mb-8 text-center text-2xl font-bold text-text">
          {t('home.how.title')}
        </h2>
        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Step icon={<Search aria-hidden="true" className="size-8" />} name="discover" />
          <Step icon={<Sparkles aria-hidden="true" className="size-8" />} name="diango" />
          <Step icon={<Heart aria-hidden="true" className="size-8" />} name="adopt" />
        </ol>
      </section>

      <Friends />

      <section
        aria-labelledby="home-band"
        className="mx-4 my-12 rounded-card bg-accent-soft px-6 py-12 text-center"
      >
        <h2 id="home-band" className="mb-6 text-2xl font-bold text-on-accent-soft">
          {t('home.band.title')}
        </h2>
        <div className="flex flex-wrap justify-center gap-4">{actions}</div>
      </section>
    </>
  );
}

/** "Ver animales" and "Encuentra tu compañero", the two big actions of the page. */
function MainActions() {
  const { t } = useTranslation();
  return (
    <>
      <Link to="/animals" className={buttonClass('primary', 'lg')}>
        <Heart aria-hidden="true" className={iconClass} />
        {t('home.actions.catalogue')}
      </Link>
      <Link to="/matching" className={buttonClass('secondary', 'lg')}>
        <Sparkles aria-hidden="true" className={iconClass} />
        {t('home.actions.matching')}
      </Link>
    </>
  );
}

/** The ADMIN's actions: "Ir al panel" first, then "Ver animales". */
function AdminActions() {
  const { t } = useTranslation();
  return (
    <>
      <Link to="/admin" className={buttonClass('primary', 'lg')}>
        <LayoutDashboard aria-hidden="true" className={iconClass} />
        {t('home.actions.panel')}
      </Link>
      <Link to="/animals" className={buttonClass('secondary', 'lg')}>
        <Heart aria-hidden="true" className={iconClass} />
        {t('home.actions.catalogue')}
      </Link>
    </>
  );
}

function Step({ icon, name }: { icon: ReactNode; name: 'discover' | 'diango' | 'adopt' }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col items-center gap-3 rounded-card border border-border-subtle bg-surface p-6 text-center shadow-soft">
      <span className="flex size-16 items-center justify-center rounded-pill bg-accent-soft text-on-accent-soft">
        {icon}
      </span>
      <h3 className="text-xl font-bold text-text">{t(`home.how.${name}.title`)}</h3>
      <p className="text-base text-text-muted">{t(`home.how.${name}.body`)}</p>
    </li>
  );
}

/** Up to three available animals; hidden when there are none or the request fails. */
function Friends() {
  const { t } = useTranslation();
  const { data } = useAnimals('');
  const animals = data?.items.slice(0, FRIENDS) ?? [];
  if (animals.length === 0) return null;

  return (
    <section aria-labelledby="home-friends" className="px-4 py-12">
      <h2 id="home-friends" className="mb-8 text-center text-2xl font-bold text-text">
        {t('home.friends.title')}
      </h2>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {animals.map((animal) => (
          <AnimalCard key={animal.id} animal={animal} headingLevel={3} />
        ))}
      </ul>
      <div className="mt-8 flex justify-center">
        <Link to="/animals" className={buttonClass('secondary', 'lg')}>
          {t('home.friends.all')}
        </Link>
      </div>
    </section>
  );
}

/** Soft background shapes and faint paws (CSS only, hidden from assistive technology). */
function Decorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Inside the hero's height (it is clipped vertically); free to spill sideways. */}
      <div className="absolute -left-24 top-6 size-72 rounded-pill bg-accent-soft" />
      <div className="absolute -right-20 bottom-6 size-80 rounded-pill bg-accent-warm" />
      <PawPrint className="absolute left-[8%] top-[55%] size-24 -rotate-12 text-brand-primary/10" />
      <PawPrint className="absolute right-[10%] top-[12%] size-20 rotate-12 text-brand-primary/10" />
    </div>
  );
}
