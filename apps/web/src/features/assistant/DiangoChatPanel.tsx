import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  type AssistantChatMessage,
  type AssistantMessageResponse,
} from '@youpetme/contracts';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../lib/http/api-error';
import { useApiClient } from '../../lib/http/api-client-context';
import { useAuth } from '../iam/auth/auth-state';
import { ASSISTANT_MESSAGES_PATH, toAssistantRequest } from './assistant-api';

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
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  return (
    <section
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="fixed bottom-24 right-4 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col rounded-control border border-border-input bg-surface shadow-lg"
    >
      <header className="flex items-center justify-between border-b border-border-input px-4 py-2">
        <h2 id={titleId} className="text-lg font-semibold text-text">
          Diango
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-control px-3 text-base text-brand-primary underline"
        >
          {t('assistant.chat.close')}
        </button>
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-label={t('assistant.chat.conversation')}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        <ol className="flex flex-col gap-2">
          <li className="self-start rounded-control bg-surface-muted px-3 py-2 text-base text-text">
            {t('assistant.chat.greeting')}
          </li>
          {messages.map((message, index) => (
            <li
              key={index}
              className={
                message.role === 'user'
                  ? 'self-end whitespace-pre-wrap rounded-control bg-brand-primary px-3 py-2 text-base text-on-brand'
                  : 'self-start whitespace-pre-wrap rounded-control bg-surface-muted px-3 py-2 text-base text-text'
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
        <p role="status" className="px-4 pb-2 text-sm text-text-muted">
          {t('assistant.chat.typing')}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mx-4 mb-2 rounded-control border-2 border-feedback-error p-2 text-base text-feedback-error"
        >
          <p>{t(`assistant.errors.${error}`)}</p>
          <button
            type="button"
            onClick={() => void ask(messages)}
            className="mt-1 min-h-11 font-semibold underline"
          >
            {t('assistant.chat.retry')}
          </button>
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-border-input p-3">
        <div className="flex flex-1 flex-col">
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {t('assistant.chat.inputLabel')}
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            rows={2}
            value={draft}
            maxLength={ASSISTANT_MESSAGE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="mt-1 w-full resize-none rounded-control border border-border-input px-2 py-1 text-base text-text"
          />
        </div>
        <button
          type="submit"
          aria-disabled={pending || undefined}
          className="min-h-11 rounded-control bg-brand-primary px-4 text-base font-semibold text-on-brand hover:bg-brand-primary-hover aria-disabled:opacity-80"
        >
          {t('assistant.chat.send')}
        </button>
      </form>
    </section>
  );
}
