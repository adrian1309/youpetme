import {
  ASSISTANT_HISTORY_MAX_MESSAGES,
  ASSISTANT_MESSAGE_MAX_LENGTH,
  ASSISTANT_REPLY_MAX_LENGTH,
  type AssistantChatMessage,
  type ValidationErrorCode,
} from '@youpetme/contracts';

export interface AssistantRequestIssue {
  field: string;
  code: ValidationErrorCode;
}

/** The chat body is not valid; reported as a 400 in the ADR-017 shape. */
export class AssistantRequestInvalidError extends Error {
  constructor(readonly issues: AssistantRequestIssue[]) {
    super('Invalid assistant request');
    this.name = 'AssistantRequestInvalidError';
  }
}

/**
 * POST /assistant/messages body. The limits bound the cost of a public endpoint: the client
 * sends only the latest messages of its session history.
 */
export function parseAssistantRequest(body: unknown): AssistantChatMessage[] {
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (messages === undefined || messages === null) fail('messages', 'REQUIRED');
  if (!Array.isArray(messages)) fail('messages', 'INVALID_TYPE');
  if (messages.length === 0) fail('messages', 'REQUIRED');
  if (messages.length > ASSISTANT_HISTORY_MAX_MESSAGES) fail('messages', 'TOO_LONG');

  const issues: AssistantRequestIssue[] = [];
  const parsed = messages.map((item: unknown, index): AssistantChatMessage => {
    const field = `messages.${index}`;
    const { role, content } = (typeof item === 'object' && item !== null ? item : {}) as Record<
      string,
      unknown
    >;
    if (role !== 'user' && role !== 'assistant') {
      issues.push({ field: `${field}.role`, code: 'INVALID_FORMAT' });
    }
    const max = role === 'assistant' ? ASSISTANT_REPLY_MAX_LENGTH : ASSISTANT_MESSAGE_MAX_LENGTH;
    if (typeof content !== 'string') {
      issues.push({ field: `${field}.content`, code: 'INVALID_TYPE' });
    } else if (content.trim().length === 0) {
      issues.push({ field: `${field}.content`, code: 'REQUIRED' });
    } else if ([...content].length > max) {
      issues.push({ field: `${field}.content`, code: 'TOO_LONG' });
    }
    return { role: role as AssistantChatMessage['role'], content: String(content).trim() };
  });
  if (issues.length === 0 && parsed.at(-1)!.role !== 'user') {
    issues.push({ field: 'messages', code: 'INVALID_FORMAT' });
  }
  if (issues.length > 0) throw new AssistantRequestInvalidError(issues);
  return parsed;
}

function fail(field: string, code: ValidationErrorCode): never {
  throw new AssistantRequestInvalidError([{ field, code }]);
}
