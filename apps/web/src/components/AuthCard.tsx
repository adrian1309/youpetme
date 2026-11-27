import { PawPrint } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Centred card for the sign-in, registration and password pages (Design System — Authentication
 * pages, SCRUM-56): paw, title, an inviting line and the form, with room above and below.
 */
export function AuthCard({
  titleId,
  title,
  intro,
  children,
}: {
  titleId: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-card border border-border-subtle bg-surface p-6 shadow-soft sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-pill bg-accent-soft text-on-accent-soft">
            <PawPrint aria-hidden="true" className="size-7" />
          </span>
          <h1 id={titleId} className="text-3xl font-bold text-text">
            {title}
          </h1>
          {intro ? <p className="mt-2 text-base text-text-muted">{intro}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
