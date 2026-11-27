import { MATCHING_DESCRIPTION_MAX_LENGTH } from '@youpetme/contracts';

import { adopterProfileSchema } from '../../application/matching/adopter-profile.schema';
import type { AdopterProfile } from '../../domain/matching/adopter-profile';
import { AssistantRequestInvalidError } from './assistant.request';

/** POST /matching body: the free-text description, trimmed. Errors are 400s in ADR-017 shape. */
export function parseMatchingRequest(body: unknown): string {
  const description = (body as { description?: unknown } | null)?.description;
  if (description === undefined || description === null) fail('description', 'REQUIRED');
  if (typeof description !== 'string') fail('description', 'INVALID_TYPE');
  const trimmed = description.trim();
  if (trimmed.length === 0) fail('description', 'REQUIRED');
  if ([...trimmed].length > MATCHING_DESCRIPTION_MAX_LENGTH) fail('description', 'TOO_LONG');
  return trimmed;
}

/** PUT /users/me/matching-preferences body: an adopter profile, enums only, no unknown keys. */
export function parseMatchingPreferencesRequest(body: unknown): AdopterProfile {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    fail('body', 'INVALID_TYPE');
  }
  const parsed = adopterProfileSchema.safeParse(body);
  if (parsed.success) return parsed.data;
  const fields = new Set(
    parsed.error.issues.flatMap((issue) =>
      issue.code === 'unrecognized_keys' ? issue.keys : [String(issue.path[0] ?? 'body')],
    ),
  );
  throw new AssistantRequestInvalidError(
    [...fields].map((field) => ({ field, code: 'INVALID_FORMAT' as const })),
  );
}

function fail(field: string, code: 'REQUIRED' | 'INVALID_TYPE' | 'TOO_LONG'): never {
  throw new AssistantRequestInvalidError([{ field, code }]);
}
