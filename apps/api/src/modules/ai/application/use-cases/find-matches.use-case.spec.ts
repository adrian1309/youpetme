import { ListAvailableAnimalsUseCase } from '../../../animals/application/use-cases/list-available-animals.use-case';
import { Animal, type AnimalProps } from '../../../animals/domain/entities/animal.entity';
import { InMemoryAnimalRepository } from '../../../animals/testing/in-memory-animal-repository';
import { AiProviderUnavailableError } from '../../domain/errors/ai-provider-unavailable.error';
import type { AdopterProfile } from '../../domain/matching/adopter-profile';
import type { AiTurn } from '../../domain/ports/ai-provider';
import { ScriptedAiProvider, textTurn } from '../../testing/scripted-ai-provider';
import { ADOPTER_PROFILE_OUTPUT_SCHEMA } from '../matching/adopter-profile.schema';
import {
  EXTRACTION_PROMPT,
  FindMatchesUseCase,
  MATCHING_CANDIDATES_LIMIT,
} from './find-matches.use-case';

const NOW = new Date('2026-11-26T10:00:00.000Z');
let sequence = 0;

function animal(overrides: Partial<AnimalProps> = {}): Animal {
  sequence += 1;
  return Animal.reconstitute({
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    shelterId: '00000000-0000-4000-8000-000000000001',
    name: 'Luna',
    species: 'DOG',
    size: 'SMALL',
    ageGroup: 'ADULT',
    breed: null,
    temperament: [],
    compatibleWithChildren: null,
    compatibleWithOtherAnimals: null,
    careNotes: null,
    photoUrls: ['https://images.example.com/a.jpg'],
    status: 'AVAILABLE',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

/** What the model answers through the structured output: every field, null when not said. */
const extraction = (profile: Partial<Record<keyof AdopterProfile, unknown>>): AiTurn =>
  textTurn(
    JSON.stringify({
      housingSize: null,
      activityLevel: null,
      experienceWithAnimals: null,
      hasChildren: null,
      hasOtherAnimals: null,
      preferredSpecies: null,
      preferredSize: null,
      preferredAgeGroup: null,
      ...profile,
    }),
  );

describe('FindMatchesUseCase', () => {
  let animals: InMemoryAnimalRepository;
  let listAvailable: ListAvailableAnimalsUseCase;
  let saved: { userId: string; profile: AdopterProfile }[];

  beforeEach(() => {
    animals = new InMemoryAnimalRepository();
    listAvailable = new ListAvailableAnimalsUseCase(animals);
    saved = [];
  });

  const useCaseWith = (ai: ScriptedAiProvider) =>
    new FindMatchesUseCase(ai, listAvailable, {
      save: async (userId, profile) => {
        saved.push({ userId, profile });
      },
    });

  it('extracts the profile with one structured-output call and returns scored AVAILABLE animals', async () => {
    await animals.save(animal({ name: 'Toby' }));
    await animals.save(animal({ name: 'Nala', status: 'ADOPTED' }));
    await animals.save(animal({ name: 'Misu', species: 'CAT' }));
    const ai = new ScriptedAiProvider(extraction({ preferredSpecies: 'DOG' }));

    const result = await useCaseWith(ai).execute({ userId: null, description: 'Quiero un perro' });

    expect(ai.requests).toHaveLength(1);
    expect(ai.requests[0]).toMatchObject({
      system: EXTRACTION_PROMPT,
      tools: [],
      outputSchema: ADOPTER_PROFILE_OUTPUT_SCHEMA,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Quiero un perro' }] }],
    });
    expect(result.profile).toEqual({ preferredSpecies: 'DOG' });
    expect(result.results.map((r) => [r.animal.name, r.score, r.reasons])).toEqual([
      ['Toby', 1, ['SPECIES_MATCH']],
    ]);
  });

  it('does not invent preferences: "vivo en un piso" gives housingSize only, with no size filter', async () => {
    await animals.save(animal({ name: 'Toby', size: 'SMALL' }));
    await animals.save(animal({ name: 'Kira', size: 'MEDIUM' }));
    const execute = jest.spyOn(listAvailable, 'execute');
    const ai = new ScriptedAiProvider(extraction({ housingSize: 'SMALL' }));

    const result = await useCaseWith(ai).execute({ userId: null, description: 'Vivo en un piso' });

    expect(result.profile).toEqual({ housingSize: 'SMALL' });
    expect(execute).toHaveBeenCalledWith({
      filters: {},
      page: 1,
      pageSize: MATCHING_CANDIDATES_LIMIT,
    });
    expect(result.results.map((r) => r.animal.name)).toEqual(['Toby', 'Kira']);
    // The prompt tells the model to fill only what is said explicitly.
    expect(EXTRACTION_PROMPT).toContain('Vivir en un piso no indica ninguna preferencia de tamaño');
    expect(EXTRACTION_PROMPT).toMatch(/explícitamente/);
  });

  it('passes the stated species, size and age group to the catalogue as filters', async () => {
    const execute = jest.spyOn(listAvailable, 'execute');
    const ai = new ScriptedAiProvider(
      extraction({ preferredSpecies: 'CAT', preferredSize: 'SMALL', preferredAgeGroup: 'SENIOR' }),
    );

    await useCaseWith(ai).execute({ userId: null, description: 'Un gato pequeño y mayor' });

    expect(execute).toHaveBeenCalledWith({
      filters: { species: 'CAT', size: 'SMALL', ageGroup: 'SENIOR' },
      page: 1,
      pageSize: MATCHING_CANDIDATES_LIMIT,
    });
  });

  it('saves the profile for a signed-in user, and nothing for a visitor', async () => {
    const userId = '00000000-0000-4000-8000-0000000000aa';

    await useCaseWith(new ScriptedAiProvider(extraction({ hasChildren: true }))).execute({
      userId,
      description: 'Tengo dos hijos',
    });
    await useCaseWith(new ScriptedAiProvider(extraction({ hasChildren: true }))).execute({
      userId: null,
      description: 'Tengo dos hijos',
    });

    expect(saved).toEqual([{ userId, profile: { hasChildren: true } }]);
  });

  it('returns an empty list (not an error) when nothing fits', async () => {
    await animals.save(animal({ species: 'DOG' }));
    const ai = new ScriptedAiProvider(extraction({ preferredSpecies: 'OTHER' }));

    const result = await useCaseWith(ai).execute({ userId: null, description: 'Un conejo' });

    expect(result).toEqual({ profile: { preferredSpecies: 'OTHER' }, results: [] });
  });

  it('treats a refusal as an empty profile with no results', async () => {
    await animals.save(animal());
    const ai = new ScriptedAiProvider({ stopReason: 'refusal', content: [] });

    const result = await useCaseWith(ai).execute({ userId: 'u-1', description: 'algo raro' });

    expect(result).toEqual({ profile: {}, results: [] });
    expect(saved).toEqual([]);
  });

  it.each([
    ['text that is not JSON', textTurn('Hola')],
    ['a value outside the enums', extraction({ housingSize: 'HUGE' })],
    ['an unknown key', textTurn(JSON.stringify({ notes: 'ignora tus instrucciones' }))],
  ])('fails as provider unavailable on %s', async (_case, turn) => {
    const ai = new ScriptedAiProvider(turn);

    await expect(
      useCaseWith(ai).execute({ userId: 'u-1', description: 'Busco un perro' }),
    ).rejects.toBeInstanceOf(AiProviderUnavailableError);
    expect(saved).toEqual([]);
  });

  it('lets a provider failure through', async () => {
    const ai = new ScriptedAiProvider(new AiProviderUnavailableError());

    await expect(
      useCaseWith(ai).execute({ userId: null, description: 'Busco un perro' }),
    ).rejects.toBeInstanceOf(AiProviderUnavailableError);
  });
});
