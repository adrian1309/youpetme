import type { ListAvailableAnimalsUseCase } from '../../../animals/application/use-cases/list-available-animals.use-case';
import type { AnimalFilters } from '../../../animals/domain/ports/animal-repository';
import {
  AGE_GROUPS,
  isOneOf,
  SIZES,
  SPECIES,
} from '../../../animals/domain/value-objects/taxonomy';
import type { AiToolDefinition } from '../../domain/ports/ai-provider';

/** Most animals one search hands to the model; `total` still tells how many match. */
export const SEARCH_ANIMALS_LIMIT = 10;

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

/**
 * Diango's only tool (ADR-011): read-only search of the public catalogue, AVAILABLE animals
 * only, with the same filters as GET /animals. Admin-written free text (care notes) and photos
 * are left out: the model does not need them and they widen the prompt-injection surface.
 */
export class SearchAnimalsTool {
  readonly definition: AiToolDefinition = {
    name: 'search_animals',
    description:
      'Busca animales DISPONIBLES para adopción en el catálogo de YouPetMe. Úsala siempre que ' +
      'necesites datos de animales concretos. Todos los filtros son opcionales; omite los que ' +
      'el usuario no haya pedido.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        species: { type: 'string', enum: [...SPECIES], description: 'DOG, CAT u OTHER' },
        size: { type: 'string', enum: [...SIZES] },
        ageGroup: { type: 'string', enum: [...AGE_GROUPS] },
        compatibleWithChildren: { type: 'boolean' },
        compatibleWithOtherAnimals: { type: 'boolean' },
      },
    },
  };

  constructor(private readonly listAvailable: ListAvailableAnimalsUseCase) {}

  async run(input: unknown): Promise<ToolOutcome> {
    const filters = parseFilters(input);
    if (!filters) {
      return { content: 'Filtros no válidos para search_animals.', isError: true };
    }
    let result: Awaited<ReturnType<ListAvailableAnimalsUseCase['execute']>>;
    try {
      result = await this.listAvailable.execute({
        filters,
        page: 1,
        pageSize: SEARCH_ANIMALS_LIMIT,
      });
    } catch {
      // Diango still answers ("I could not check the catalogue") instead of the chat failing.
      return { content: 'No se ha podido consultar el catálogo.', isError: true };
    }
    return {
      isError: false,
      content: JSON.stringify({
        total: result.total,
        animals: result.items.map((animal) => ({
          id: animal.id,
          name: animal.name,
          species: animal.species,
          size: animal.size,
          ageGroup: animal.ageGroup,
          breed: animal.breed,
          temperament: animal.temperament,
          compatibleWithChildren: animal.compatibleWithChildren,
          compatibleWithOtherAnimals: animal.compatibleWithOtherAnimals,
        })),
      }),
    };
  }
}

/** Null when the model sent anything outside the schema. */
function parseFilters(input: unknown): AnimalFilters | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const filters: AnimalFilters = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (key === 'species' && typeof value === 'string' && isOneOf(SPECIES, value)) {
      filters.species = value;
    } else if (key === 'size' && typeof value === 'string' && isOneOf(SIZES, value)) {
      filters.size = value;
    } else if (key === 'ageGroup' && typeof value === 'string' && isOneOf(AGE_GROUPS, value)) {
      filters.ageGroup = value;
    } else if (
      (key === 'compatibleWithChildren' || key === 'compatibleWithOtherAnimals') &&
      typeof value === 'boolean'
    ) {
      filters[key] = value;
    } else {
      return null;
    }
  }
  return filters;
}
