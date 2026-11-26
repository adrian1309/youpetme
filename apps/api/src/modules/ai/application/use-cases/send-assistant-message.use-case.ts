import type { AiBlock, AiMessage, AiProvider } from '../../domain/ports/ai-provider';
import type { AssistantUserContextReader } from '../../domain/ports/assistant-user-context';
import { diangoSystemPrompt } from '../diango-system-prompt';
import type { SearchAnimalsTool } from '../tools/search-animals.tool';

/** Model calls per user message, tool rounds included: bounds cost and latency. */
export const MAX_MODEL_CALLS = 3;
export const TOOL_LIMIT_REPLY =
  'No he podido completar la búsqueda. ¿Puedes reformular la pregunta?';
export const REFUSAL_REPLY =
  'No puedo ayudarte con eso. Pregúntame sobre YouPetMe, la adopción o los animales del catálogo.';
const EMPTY_REPLY = 'No tengo una respuesta ahora mismo. ¿Puedes repetir la pregunta?';

export interface SendAssistantMessageCommand {
  /** Null for a visitor. */
  userId: string | null;
  /** The session history the client resends, ending with the new user message. */
  messages: { role: 'user' | 'assistant'; content: string }[];
}

/**
 * One Diango answer (ADR-011): a single agent with one read-only tool. Nothing is stored; the
 * client keeps the session history.
 */
export class SendAssistantMessageUseCase {
  constructor(
    private readonly ai: AiProvider,
    private readonly searchAnimals: SearchAnimalsTool,
    private readonly users: AssistantUserContextReader,
  ) {}

  async execute(command: SendAssistantMessageCommand): Promise<{ reply: string }> {
    const user = command.userId ? await this.users.find(command.userId) : null;
    const system = diangoSystemPrompt(user);
    const tools = [this.searchAnimals.definition];
    const messages: AiMessage[] = command.messages.map((message) => ({
      role: message.role,
      content: [{ type: 'text', text: message.content }],
    }));

    for (let call = 1; call <= MAX_MODEL_CALLS; call += 1) {
      const turn = await this.ai.complete({ system, messages, tools });
      if (turn.stopReason === 'refusal') return { reply: REFUSAL_REPLY };

      const toolUses = turn.content.filter(
        (block): block is Extract<AiBlock, { type: 'tool_use' }> => block.type === 'tool_use',
      );
      if (turn.stopReason !== 'tool_use' || toolUses.length === 0) {
        return { reply: textOf(turn.content) || EMPTY_REPLY };
      }

      messages.push({ role: 'assistant', content: turn.content, providerData: turn.providerData });
      const results: AiBlock[] = [];
      for (const toolUse of toolUses) {
        const outcome =
          toolUse.name === this.searchAnimals.definition.name
            ? await this.searchAnimals.run(toolUse.input)
            : { content: `Herramienta desconocida: ${toolUse.name}`, isError: true };
        results.push({
          type: 'tool_result',
          toolUseId: toolUse.id,
          content: outcome.content,
          isError: outcome.isError,
        });
      }
      messages.push({ role: 'user', content: results });
    }
    return { reply: TOOL_LIMIT_REPLY };
  }
}

function textOf(content: AiBlock[]): string {
  return content
    .filter((block): block is Extract<AiBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}
