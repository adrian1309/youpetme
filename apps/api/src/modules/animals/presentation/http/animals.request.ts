import { ANIMALS_PAGE_SIZE_DEFAULT, ANIMALS_PAGE_SIZE_MAX } from '@youpetme/contracts';
import { z } from 'zod';

import type { RegisterAnimalCommand } from '../../application/commands/register-animal.command';
import type { AnimalValidationIssue } from '../../domain/errors/animal-validation.error';
import type { AnimalFilters } from '../../domain/ports/animal-repository';
import { AGE_GROUPS, isOneOf, SIZES, SPECIES } from '../../domain/value-objects/taxonomy';

/**
 * Transport-shape validation only (types and presence). The taxonomy and the other business
 * rules live in the domain; a missing required field becomes empty and is reported there.
 */
const createAnimalBodySchema = z.object({
  name: z.string().default(''),
  species: z.string().default(''),
  size: z.string().default(''),
  ageGroup: z.string().default(''),
  photoUrls: z.array(z.string()).default([]),
  breed: z.string().nullable().optional(),
  temperament: z.array(z.string()).optional(),
  compatibleWithChildren: z.boolean().nullable().optional(),
  compatibleWithOtherAnimals: z.boolean().nullable().optional(),
  careNotes: z.string().nullable().optional(),
});

export type Parsed<T> = { ok: true; value: T } | { ok: false; issues: AnimalValidationIssue[] };

export function parseCreateAnimalBody(body: unknown): Parsed<RegisterAnimalCommand> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, issues: [{ field: 'body', code: 'INVALID_TYPE' }] };
  }
  const parsed = createAnimalBodySchema.safeParse(body);
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'body')));
    return { ok: false, issues: [...fields].map((field) => ({ field, code: 'INVALID_TYPE' })) };
  }
  return { ok: true, value: parsed.data };
}

export interface CatalogueQuery {
  filters: AnimalFilters;
  page: number;
  pageSize: number;
}

/** GET /api/v1/animals query; an unknown value is a 400, never silently ignored. */
export function parseCatalogueQuery(query: Record<string, unknown>): Parsed<CatalogueQuery> {
  const issues: AnimalValidationIssue[] = [];
  const filters: AnimalFilters = {};

  const enumParam = <T extends string>(field: string, allowed: readonly T[]): T | undefined => {
    const value = query[field];
    if (value === undefined) return undefined;
    if (typeof value === 'string' && isOneOf(allowed, value)) return value;
    issues.push({ field, code: 'INVALID_FORMAT' });
    return undefined;
  };
  const booleanParam = (field: string): boolean | undefined => {
    const value = query[field];
    if (value === undefined) return undefined;
    if (value === 'true' || value === 'false') return value === 'true';
    issues.push({ field, code: 'INVALID_FORMAT' });
    return undefined;
  };
  const integerParam = (field: string, fallback: number, max: number): number => {
    const value = query[field];
    if (value === undefined) return fallback;
    const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
    if (number >= 1 && number <= max) return number;
    issues.push({ field, code: 'INVALID_FORMAT' });
    return fallback;
  };

  const species = enumParam('species', SPECIES);
  const size = enumParam('size', SIZES);
  const ageGroup = enumParam('ageGroup', AGE_GROUPS);
  const compatibleWithChildren = booleanParam('compatibleWithChildren');
  const compatibleWithOtherAnimals = booleanParam('compatibleWithOtherAnimals');
  if (species) filters.species = species;
  if (size) filters.size = size;
  if (ageGroup) filters.ageGroup = ageGroup;
  if (compatibleWithChildren !== undefined) filters.compatibleWithChildren = compatibleWithChildren;
  if (compatibleWithOtherAnimals !== undefined) {
    filters.compatibleWithOtherAnimals = compatibleWithOtherAnimals;
  }

  const page = integerParam('page', 1, Number.MAX_SAFE_INTEGER);
  const pageSize = integerParam('pageSize', ANIMALS_PAGE_SIZE_DEFAULT, ANIMALS_PAGE_SIZE_MAX);

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: { filters, page, pageSize } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
