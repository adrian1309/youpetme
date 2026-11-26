import {
  ASSISTANT_HISTORY_MAX_MESSAGES,
  ASSISTANT_REPLY_MAX_LENGTH,
  type AssistantChatMessage,
  type AssistantMessageRequest,
} from '@youpetme/contracts';

export const ASSISTANT_MESSAGES_PATH = '/api/v1/assistant/messages';
export const WELCOME_SEEN_PATH = '/api/v1/users/me/welcome-seen';

/**
 * The body for the next question: the latest messages of the session (ADR-011, session memory
 * only), starting with a user message as the model expects, and replies cut to the API limit.
 */
export function toAssistantRequest(history: AssistantChatMessage[]): AssistantMessageRequest {
  const latest = history.slice(-ASSISTANT_HISTORY_MAX_MESSAGES);
  const firstUser = latest.findIndex((message) => message.role === 'user');
  return {
    messages: latest
      .slice(Math.max(firstUser, 0))
      .map((message) =>
        message.role === 'assistant'
          ? { ...message, content: message.content.slice(0, ASSISTANT_REPLY_MAX_LENGTH) }
          : message,
      ),
  };
}
