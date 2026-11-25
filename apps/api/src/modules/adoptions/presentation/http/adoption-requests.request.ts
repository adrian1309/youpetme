import {
  ADOPTION_MESSAGE_MAX_LENGTH,
  ADOPTION_REQUESTS_PAGE_SIZE_DEFAULT,
  ADOPTION_REQUESTS_PAGE_SIZE_MAX,
} from '@youpetme/contracts';

import type { AdoptionValidationIssue } from '../../domain/errors/adoption-errors';
import type { AdoptionRequestFilters } from '../../domain/ports/adoption-request-repository';
import {
  ADOPTION_ACTIONS,
  ADOPTION_STATUSES,
  type AdoptionAction,
} from '../../domain/value-objects/adoption-states';

type Parsed<T> = { ok: true; value: T } | { ok: false; issues: AdoptionValidationIssue[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

export function isAction(value: string): value is AdoptionAction {
  return (ADOPTION_ACTIONS as readonly string[]).includes(value);
}

/** POST body: animalId (UUID) and an optional message; the length is checked by the domain. */
export function parseSubmitBody(
  body: unknown,
): Parsed<{ animalId: string; message: string | null }> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, issues: [{ field: 'body', code: 'INVALID_TYPE' }] };
  }
  const { animalId, message } = body as Record<string, unknown>;
  const issues: AdoptionValidationIssue[] = [];
  if (animalId === undefined || animalId === null || animalId === '') {
    issues.push({ field: 'animalId', code: 'REQUIRED' });
  } else if (!isUuid(animalId)) {
    issues.push({ field: 'animalId', code: 'INVALID_FORMAT' });
  }
  if (message !== undefined && message !== null && typeof message !== 'string') {
    issues.push({ field: 'message', code: 'INVALID_TYPE' });
  } else if (typeof message === 'string' && message.trim().length > ADOPTION_MESSAGE_MAX_LENGTH) {
    // Also checked by the domain; repeated here so every failing field is reported at once.
    issues.push({ field: 'message', code: 'TOO_LONG' });
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: { animalId: animalId as string, message: (message as string | null) ?? null },
  };
}

/** GET query: status, animalId, page and pageSize; anything not allowed is a 400. */
export function parseListQuery(
  query: Record<string, unknown>,
): Parsed<{ filters: AdoptionRequestFilters; page: number; pageSize: number }> {
  const issues: AdoptionValidationIssue[] = [];
  const filters: AdoptionRequestFilters = {};

  const { status, animalId } = query;
  if (status !== undefined) {
    if (typeof status === 'string' && (ADOPTION_STATUSES as readonly string[]).includes(status)) {
      filters.status = status as AdoptionRequestFilters['status'];
    } else issues.push({ field: 'status', code: 'INVALID_FORMAT' });
  }
  if (animalId !== undefined) {
    if (isUuid(animalId)) filters.animalId = animalId;
    else issues.push({ field: 'animalId', code: 'INVALID_FORMAT' });
  }

  const integer = (field: string, fallback: number, max: number): number => {
    const value = query[field];
    if (value === undefined) return fallback;
    const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
    if (number >= 1 && number <= max) return number;
    issues.push({ field, code: 'INVALID_FORMAT' });
    return fallback;
  };
  const page = integer('page', 1, Number.MAX_SAFE_INTEGER);
  const pageSize = integer(
    'pageSize',
    ADOPTION_REQUESTS_PAGE_SIZE_DEFAULT,
    ADOPTION_REQUESTS_PAGE_SIZE_MAX,
  );

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: { filters, page, pageSize } };
}
