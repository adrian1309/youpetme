import type {
  AiBlock,
  AiCompletionRequest,
  AiProvider,
  AiTurn,
} from '../../domain/ports/ai-provider';

/**
 * Predictable stand-in for development and automated tests (AI_PROVIDER=fake): fixed rules, no
 * network. Rejected in production by the configuration (ADR-011).
 */
export class FakeAiProvider implements AiProvider {
  async complete(request: AiCompletionRequest): Promise<AiTurn> {
    if (request.outputSchema) return text(JSON.stringify(extractProfile(lastUserText(request))));

    const last = request.messages.at(-1);
    const toolResult = last?.content.find(
      (block): block is Extract<AiBlock, { type: 'tool_result' }> => block.type === 'tool_result',
    );
    if (toolResult) return text(describeResult(toolResult.content));

    const question = (last?.content ?? [])
      .filter((block): block is Extract<AiBlock, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text.toLowerCase())
      .join(' ');
    const species = /perr/.test(question) ? 'DOG' : /gat/.test(question) ? 'CAT' : null;
    if (species) {
      return {
        stopReason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'fake-search',
            name: 'search_animals',
            input: { species, ...(/pequeñ/.test(question) ? { size: 'SMALL' } : {}) },
          },
        ],
      };
    }

    const name = /se llama ([^.\s]+)\./.exec(request.system)?.[1];
    return text(
      `Hola${name ? `, ${name}` : ''}. Soy Diango (modo de prueba). Pregúntame por perros o gatos.`,
    );
  }
}

function lastUserText(request: AiCompletionRequest): string {
  return (request.messages.at(-1)?.content ?? [])
    .filter((block): block is Extract<AiBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text.toLowerCase())
    .join(' ');
}

/** AI Matching's extraction by keywords: only what the text says, null for the rest. */
function extractProfile(description: string): Record<string, unknown> {
  const says = (pattern: RegExp) => pattern.test(description);
  return {
    housingSize: says(/piso|apartamento/) ? 'SMALL' : says(/jard[ií]n/) ? 'LARGE' : null,
    activityLevel: says(/tranquil/) ? 'LOW' : says(/activ|deporte|correr/) ? 'HIGH' : null,
    experienceWithAnimals: says(/primera vez|nunca he tenido/) ? 'NONE' : null,
    hasChildren: says(/niñ|hij/) ? true : null,
    hasOtherAnimals: says(/otros? (perr|gat|animal)/) ? true : null,
    preferredSpecies: says(/perr/) ? 'DOG' : says(/gat/) ? 'CAT' : null,
    preferredSize: says(/pequeñ/) ? 'SMALL' : null,
    preferredAgeGroup: says(/cachorr/) ? 'PUPPY_KITTEN' : null,
  };
}

function describeResult(content: string): string {
  try {
    const result = JSON.parse(content) as { total: number; animals: { name: string }[] };
    if (result.animals.length === 0) return 'No he encontrado animales disponibles con eso.';
    return `He encontrado ${result.total}: ${result.animals.map((a) => a.name).join(', ')}.`;
  } catch {
    return 'No he podido buscar en el catálogo.';
  }
}

const text = (value: string): AiTurn => ({
  stopReason: 'end_turn',
  content: [{ type: 'text', text: value }],
});
