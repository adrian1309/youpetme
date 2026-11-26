/** Diango, the AI assistant (ADR-011, SCRUM-18). Session memory: the client resends the history. */

/** Longest message a user can send. */
export const ASSISTANT_MESSAGE_MAX_LENGTH = 1000;
/** Longest earlier Diango reply the client may resend as history. */
export const ASSISTANT_REPLY_MAX_LENGTH = 4000;
/** Most messages (user and assistant) one request may carry; the client sends the latest ones. */
export const ASSISTANT_HISTORY_MAX_MESSAGES = 20;

export type AssistantMessageRole = 'user' | 'assistant';

export interface AssistantChatMessage {
  role: AssistantMessageRole;
  /** Plain text. */
  content: string;
}

/** POST /api/v1/assistant/messages. The last message is the user's new question. */
export interface AssistantMessageRequest {
  messages: AssistantChatMessage[];
}

export interface AssistantMessageResponse {
  /** Diango's answer, plain text. */
  reply: string;
}
