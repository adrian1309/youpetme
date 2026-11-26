import type { AiCompletionRequest, AiProvider, AiTurn } from '../domain/ports/ai-provider';

/** Test double: answers with the queued turns in order and records every request. */
export class ScriptedAiProvider implements AiProvider {
  readonly requests: AiCompletionRequest[] = [];
  private readonly turns: (AiTurn | Error)[];

  constructor(...turns: (AiTurn | Error)[]) {
    this.turns = turns;
  }

  async complete(request: AiCompletionRequest): Promise<AiTurn> {
    // Copy: the use case keeps appending to the same array.
    this.requests.push({ ...request, messages: [...request.messages] });
    const next = this.turns.shift();
    if (!next) throw new Error('ScriptedAiProvider ran out of turns');
    if (next instanceof Error) throw next;
    return next;
  }
}

export const textTurn = (text: string): AiTurn => ({
  stopReason: 'end_turn',
  content: [{ type: 'text', text }],
});

export const toolTurn = (input: unknown, id = 'toolu_1'): AiTurn => ({
  stopReason: 'tool_use',
  content: [{ type: 'tool_use', id, name: 'search_animals', input }],
  providerData: { raw: id },
});
