import { Check } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { primaryButtonClass } from '../../components/button-styles';
import { useApiClient } from '../../lib/http/api-client-context';
import { readDiangoWelcomeSeen, writeDiangoWelcomeSeen } from '../../lib/storage/diango-welcome';
import { useAuth } from '../iam/auth/auth-state';
import { WELCOME_SEEN_PATH } from './assistant-api';
import { DiangoChatPanel } from './DiangoChatPanel';
import { DiangoMascot } from './DiangoMascot';

/**
 * Diango, always present (ADR-011). On a first visit it appears centred with one speech bubble
 * (SCRUM-17); once closed it sits bottom-right as the chat launcher (SCRUM-18). "Already seen" is
 * the account's hasSeenWelcome when signed in, or a localStorage mark for a guest.
 */
export function Diango() {
  const { status, isAuthenticated, session, authorized } = useAuth();
  const [guestSeen] = useState(readDiangoWelcomeSeen);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const client = useApiClient();
  const { t } = useTranslation();

  if (status === 'restoring') return null;

  const seen = isAuthenticated ? session!.user.hasSeenWelcome : guestSeen;
  const showWelcome = !seen && !dismissed;

  function closeWelcome(): void {
    setDismissed(true);
    writeDiangoWelcomeSeen();
    if (isAuthenticated) {
      // Best effort: if it fails, the welcome shows once more on another visit.
      authorized((accessToken) => client.put(WELCOME_SEEN_PATH, { accessToken })).catch(() => {});
    }
    // The launcher mounts with the welcome gone; focus it so keyboard users are not lost.
    queueMicrotask(() => launcherRef.current?.focus());
  }

  function closeChat(): void {
    setOpen(false);
    launcherRef.current?.focus();
  }

  if (showWelcome) return <DiangoWelcome onClose={closeWelcome} />;

  return (
    <>
      {open && <DiangoChatPanel id={panelId} onClose={closeChat} />}
      <button
        ref={launcherRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? t('assistant.launcher.close') : t('assistant.launcher.open')}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 right-4 z-40 flex size-16 items-center justify-center rounded-full border-2 border-brand-primary bg-surface shadow-lg hover:bg-surface-muted"
      >
        <DiangoMascot className="size-12" />
      </button>
    </>
  );
}

function DiangoWelcome({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const textId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-accent-soft/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          // "Entendido" is the only control: Tab stays on it (focus trapped).
          if (event.key === 'Tab') {
            event.preventDefault();
            closeRef.current?.focus();
          }
        }}
        className="flex max-w-sm flex-col items-center gap-1"
      >
        <div className="relative rounded-card border border-brand-primary bg-accent-soft p-5 text-center shadow-lg">
          <h2 id={titleId} className="text-xl font-semibold text-on-accent-soft">
            {t('assistant.welcome.title')}
          </h2>
          <p id={textId} className="mt-2 text-base text-text">
            {t('assistant.welcome.text')}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`${primaryButtonClass} mt-4`}
          >
            <Check aria-hidden="true" className="size-5" />
            {t('assistant.welcome.close')}
          </button>
          {/* Speech-bubble tail pointing down at Diango. */}
          <span
            aria-hidden="true"
            className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-b border-r border-brand-primary bg-accent-soft"
          />
        </div>
        <DiangoMascot className="size-48" />
      </div>
    </div>
  );
}
