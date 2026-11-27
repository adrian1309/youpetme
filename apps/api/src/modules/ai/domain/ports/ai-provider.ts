/**
 * The one door to a language model (ADR-011, ARCH-002 — no LangChain). Provider-neutral: the
 * Anthropic SDK lives only in its adapter.
 */
export type AiBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

export interface AiMessage {
  role: 'user' | 'assistant';
  content: AiBlock[];
  /**
   * The adapter's own copy of an assistant turn it produced (e.g. thinking blocks), sent back
   * unchanged within the same tool loop. Opaque to everything but that adapter.
   */
  providerData?: unknown;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  /** JSON Schema of the tool input. */
  inputSchema: Record<string, unknown>;
}

export interface AiCompletionRequest {
  system: string;
  messages: AiMessage[];
  tools: AiToolDefinition[];
  /**
   * JSON Schema the answer must follow (structured output). The answer is then one text block
   * holding that JSON. Used by AI Matching's extraction (ADR-010).
   */
  outputSchema?: Record<string, unknown>;
}

export type AiStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';

export interface AiTurn {
  stopReason: AiStopReason;
  content: AiBlock[];
  providerData?: unknown;
}

export interface AiProvider {
  /** One model call. Throws AiProviderUnavailableError when the provider fails or times out. */
  complete(request: AiCompletionRequest): Promise<AiTurn>;
}
