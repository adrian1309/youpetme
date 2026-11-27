import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  type AssistantChatMessage,
  type AssistantMessageResponse,
} from '@youpetme/contracts';
import { Send, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../lib/http/api-error';
import { useApiClient } from '../../lib/http/api-client-context';
import { useAuth } from '../iam/auth/auth-state';
import { ASSISTANT_MESSAGES_PATH, toAssistantRequest } from './assistant-api';
import { DiangoMascot } from './DiangoMascot';

type ChatError = 'unavailable' | 'rateLimited';

interface DiangoChatPanelProps {
  id: string;
  onClose(): void;
}

/**
 * Diango's chat (SCRUM-18). The history lives in this component only: it is lost on reload, as
 * ADR-011 asks (no memory across sessions). Replies are plain text.
 */
export function DiangoChatPanel({ id, onClose }: DiangoChatPanelProps) {
  const { t } = useTranslation();
  const client = useApiClient();
  const { isAuthenticated, authorized } = useAuth();
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the latest message (and the thinking indicator) in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  async function ask(history: AssistantChatMessage[]): Promise<void> {
    setPending(true);
    setError(null);
    const body = toAssistantRequest(history);
    try {
      const response = isAuthenticated
        ? await authorized((accessToken) =>
            client.post<AssistantMessageResponse>(ASSISTANT_MESSAGES_PATH, body, { accessToken }),
          )
        : await client.post<AssistantMessageResponse>(ASSISTANT_MESSAGES_PATH, body);
      setMessages([...history, { role: 'assistant', content: response.reply }]);
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 429 ? 'rateLimited' : 'unavailable',
      );
    } finally {
      setPending(false);
    }
  }

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;
    const history: AssistantChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(history);
    setDraft('');
    void ask(history);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter sends; Shift+Enter starts a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const empty = draft.trim() === '';

  return (
    <section
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="fixed inset-x-2 bottom-20 top-20 z-40 flex flex-col overflow-hidden rounded-card border border-border-subtle bg-surface shadow-lg sm:inset-x-auto sm:right-4 sm:top-auto sm:max-h-[70vh] sm:w-[24rem]"
    >
      <header className="flex items-center gap-3 border-b border-border-subtle px-5 py-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-accent-soft">
          <DiangoMascot className="size-8" />
        </span>
        <div className="flex-1">
          <h2 id={titleId} className="text-lg font-semibold text-text">
            Diango
          </h2>
          <p className="text-sm text-text-muted">{t('assistant.chat.status')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('assistant.chat.close')}
          className="flex size-11 items-center justify-center rounded-pill text-text hover:bg-accent-soft"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={t('assistant.chat.conversation')}
        className="flex-1 overflow-y-auto px-5 py-4"
      >
        <ol className="flex flex-col gap-3">
          <li className="max-w-[85%] self-start rounded-card rounded-bl-control bg-accent-soft px-4 py-2.5 text-base text-text">
            {t('assistant.chat.greeting')}
          </li>
          {messages.map((message, index) => (
            <li
              key={index}
              className={
                message.role === 'user'
                  ? 'max-w-[85%] self-end whitespace-pre-wrap rounded-card rounded-br-control bg-brand-primary px-4 py-2.5 text-base text-on-brand'
                  : 'max-w-[85%] self-start whitespace-pre-wrap rounded-card rounded-bl-control bg-accent-soft px-4 py-2.5 text-base text-text'
              }
            >
              <span className="sr-only">
                {message.role === 'user' ? t('assistant.chat.you') : t('assistant.chat.diango')}
              </span>
              {message.content}
            </li>
          ))}
        </ol>
      </div>

      {pending && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-5 pb-3 text-sm text-text-muted"
        >
          <span aria-hidden="true" className="diango-typing flex gap-1">
            <span className="size-1.5 rounded-pill bg-brand-primary" />
            <span className="size-1.5 rounded-pill bg-brand-primary" />
            <span className="size-1.5 rounded-pill bg-brand-primary" />
          </span>
          {t('assistant.chat.typing')}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mx-5 mb-3 rounded-card border-2 border-feedback-error p-3 text-base text-feedback-error"
        >
          <p>{t(`assistant.errors.${error}`)}</p>
          <button
            type="button"
            onClick={() => void ask(messages)}
            className="mt-2 min-h-11 rounded-pill border-2 border-current px-4 font-bold"
          >
            {t('assistant.chat.retry')}
          </button>
        </div>
      )}

      <form
        onSubmit={submit}
        className="flex items-end gap-2 border-t border-border-subtle bg-page px-4 py-4"
      >
        <div className="flex flex-1 flex-col">
          <label htmlFor={inputId} className="mb-1 px-3 text-sm font-medium text-text">
            {t('assistant.chat.inputLabel')}
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={ASSISTANT_MESSAGE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="max-h-32 min-h-11 w-full resize-none rounded-pill border border-border-input bg-surface px-4 py-2.5 text-base text-text focus:border-brand-primary"
          />
        </div>
        <button
          type="submit"
          aria-label={t('assistant.chat.send')}
          aria-disabled={pending || empty || undefined}
          className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-brand-primary text-on-brand hover:bg-brand-primary-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        >
          <Send aria-hidden="true" className="size-5" />
        </button>
      </form>
    </section>
  );
}
