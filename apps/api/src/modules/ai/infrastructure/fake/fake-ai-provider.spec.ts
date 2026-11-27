import type { AiCompletionRequest } from '../../domain/ports/ai-provider';
import { FakeAiProvider } from './fake-ai-provider';

const request = (overrides: Partial<AiCompletionRequest>): AiCompletionRequest => ({
  system: 'Eres Diango.',
  tools: [],
  messages: [],
  ...overrides,
});

const ask = (text: string) => [
  { role: 'user' as const, content: [{ type: 'text' as const, text }] },
];

describe('FakeAiProvider', () => {
  const ai = new FakeAiProvider();

  it('asks for a small-dog search when the user asks about small dogs', async () => {
    const turn = await ai.complete(request({ messages: ask('¿Tenéis perros pequeños?') }));

    expect(turn.stopReason).toBe('tool_use');
    expect(turn.content[0]).toMatchObject({
      type: 'tool_use',
      name: 'search_animals',
      input: { species: 'DOG', size: 'SMALL' },
    });
  });

  it('answers from the tool result, naming the animals found', async () => {
    const turn = await ai.complete(
      request({
        messages: [
          ...ask('¿Tenéis gatos?'),
          {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 't1', name: 'search_animals', input: {} }],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                toolUseId: 't1',
                content: JSON.stringify({
                  total: 2,
                  animals: [{ name: 'Mishi' }, { name: 'Tom' }],
                }),
              },
            ],
          },
        ],
      }),
    );

    expect(turn.stopReason).toBe('end_turn');
    expect(turn.content).toEqual([{ type: 'text', text: 'He encontrado 2: Mishi, Tom.' }]);
  });

  it('greets by name when the system prompt carries the user context', async () => {
    const turn = await ai.complete(
      request({
        system:
          'Eres Diango.\nContexto: hablas con un usuario con sesión iniciada que se llama Ana. Puedes',
        messages: ask('Hola'),
      }),
    );

    expect(turn.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Hola, Ana'),
    });
  });

  describe('matching extraction (structured output)', () => {
    const extract = async (text: string) => {
      const turn = await ai.complete(
        request({ system: 'Extractor', messages: ask(text), outputSchema: { type: 'object' } }),
      );
      expect(turn.stopReason).toBe('end_turn');
      const [block] = turn.content;
      return JSON.parse(block?.type === 'text' ? block.text : 'null') as Record<string, unknown>;
    };

    it('answers every field, null when the text does not say it', async () => {
      expect(await extract('Hola')).toEqual({
        housingSize: null,
        activityLevel: null,
        experienceWithAnimals: null,
        hasChildren: null,
        hasOtherAnimals: null,
        preferredSpecies: null,
        preferredSize: null,
        preferredAgeGroup: null,
      });
    });

    it('takes "vivo en un piso" as housing only, never as a size preference', async () => {
      expect(await extract('Vivo en un piso')).toMatchObject({
        housingSize: 'SMALL',
        preferredSize: null,
      });
    });

    it('reads the keyword rules', async () => {
      expect(
        await extract(
          'Busco un perro pequeño, tengo hijos y otro gato, soy muy activa y es mi primera vez',
        ),
      ).toEqual({
        housingSize: null,
        activityLevel: 'HIGH',
        experienceWithAnimals: 'NONE',
        hasChildren: true,
        hasOtherAnimals: true,
        preferredSpecies: 'DOG',
        preferredSize: 'SMALL',
        preferredAgeGroup: null,
      });
    });
  });
});
