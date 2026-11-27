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
 * `/` (SCRUM-20, SCRUM-56): a warm hero with the two main actions, how it works, a few animals
 * and a closing band for a visitor; a greeting with the actions (and the animals) once signed in.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { session, accountCreated } = useAuth();

  if (session?.user.role === 'ADMIN') {
    return (
      <Greeting name={session.user.firstName}>
        <Link to="/admin" className={buttonClass('primary', 'lg')}>
          <LayoutDashboard aria-hidden="true" className={iconClass} />
          {t('home.actions.panel')}
        </Link>
        <Link to="/animals" className={buttonClass('secondary', 'lg')}>
          <Heart aria-hidden="true" className={iconClass} />
          {t('home.actions.catalogue')}
        </Link>
      </Greeting>
    );
  }

  if (session) {
    return (
      <>
        <Greeting
          name={session.user.firstName}
          subtitle={t('home.user.subtitle')}
          notice={accountCreated ? t('home.accountCreated') : undefined}
        >
          <MainActions />
        </Greeting>
        <Friends />
      </>
    );
  }

  return (
    <>
      <PageTitle />
      <section className="relative overflow-hidden px-4 py-20 text-center sm:py-28">
        <Decorations />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="mx-auto max-w-2xl text-[2rem] font-semibold leading-tight text-text sm:text-[2.75rem]">
            {t('home.hero.title')}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-text-muted sm:text-xl">
            {t('home.hero.subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <MainActions />
          </div>
          <p className="mt-6 text-base text-text-muted">
            {t('home.hero.loginPrompt')} <Link to="/login">{t('home.hero.login')}</Link>
          </p>
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
        <div className="flex flex-wrap justify-center gap-4">
          <MainActions />
        </div>
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

function Greeting({
  name,
  subtitle,
  notice,
  children,
}: {
  name: string;
  subtitle?: string;
  notice?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden px-4 py-16 text-center">
      <PageTitle />
      <Decorations />
      <div className="relative mx-auto max-w-3xl">
        {notice ? (
          <div className="mx-auto mb-6 max-w-md text-left">
            <Notice>{notice}</Notice>
          </div>
        ) : null}
        <h1 className="text-[2rem] font-semibold leading-tight text-text sm:text-[2.75rem]">
          {t('home.greeting', { name })}
        </h1>
        {subtitle ? <p className="mt-4 text-lg text-text-muted sm:text-xl">{subtitle}</p> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-4">{children}</div>
      </div>
    </section>
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
      <div className="absolute -left-24 -top-24 size-72 rounded-pill bg-accent-soft" />
      <div className="absolute -bottom-28 -right-20 size-80 rounded-pill bg-accent-warm" />
      <PawPrint className="absolute left-[8%] top-[55%] size-24 -rotate-12 text-brand-primary/10" />
      <PawPrint className="absolute right-[10%] top-[12%] size-20 rotate-12 text-brand-primary/10" />
    </div>
  );
}
