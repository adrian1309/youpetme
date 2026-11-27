import { useQuery } from '@tanstack/react-query';
import type { ListAdoptionRequestsResponse } from '@youpetme/contracts';
import { CirclePlus, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PageTitle } from '../../components/PageTitle';
import { useApiClient } from '../../lib/http/api-client-context';
import { ADOPTION_REQUESTS_PATH } from '../adoptions/request/AdoptionRequestSection';
import { useAuth } from '../iam/auth/auth-state';

/**
 * `/admin` (SCRUM-56): the ADMIN's starting point, with two entries of equal weight. The pending
 * count reads `total` from the existing list filtered by PENDING; no endpoint of its own.
 */
export function AdminPanelPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const { authorized } = useAuth();
  const title = t('admin.panel.title');

  const pending = useQuery({
    queryKey: ['adoption-requests', 'pending-count'],
    queryFn: ({ signal }) =>
      authorized((accessToken) =>
        client.get<ListAdoptionRequestsResponse>(`${ADOPTION_REQUESTS_PATH}?status=PENDING`, {
          accessToken,
          signal,
        }),
      ),
  });

  const count = pending.data
    ? t('admin.panel.requests.pending', { count: pending.data.total })
    : pending.isError
      ? t('admin.panel.requests.unavailable')
      : t('admin.panel.requests.loading');

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <PageTitle title={title} />
      <h1 className="mb-8 text-3xl font-bold text-text">{title}</h1>
      <ul className="grid gap-6 sm:grid-cols-2">
        <PanelCard
          to="/admin/animals/new"
          icon={<CirclePlus aria-hidden="true" className="size-8" />}
          title={t('admin.panel.registerAnimal.title')}
        >
          {t('admin.panel.registerAnimal.body')}
        </PanelCard>
        <PanelCard
          to="/admin/adoption-requests"
          icon={<Inbox aria-hidden="true" className="size-8" />}
          title={t('admin.panel.requests.title')}
        >
          <span role="status">{count}</span>
        </PanelCard>
      </ul>
    </div>
  );
}

/** A whole-card link (stretched over the card), named by its title only. */
function PanelCard({
  to,
  icon,
  title,
  children,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="relative flex flex-col gap-4 rounded-card border border-border-subtle bg-surface p-6 shadow-soft hover:border-brand-primary">
      <span className="flex size-14 items-center justify-center rounded-pill bg-accent-soft text-on-accent-soft">
        {icon}
      </span>
      <h2 className="text-xl font-bold text-text">
        <Link to={to} className="after:absolute after:inset-0">
          {title}
        </Link>
      </h2>
      <p className="text-base text-text-muted">{children}</p>
    </li>
  );
}
