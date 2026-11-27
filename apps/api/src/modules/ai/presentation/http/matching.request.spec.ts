import { MATCHING_DESCRIPTION_MAX_LENGTH } from '@youpetme/contracts';

import { AssistantRequestInvalidError } from './assistant.request';
import { parseMatchingPreferencesRequest, parseMatchingRequest } from './matching.request';

function issuesOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof AssistantRequestInvalidError) return error.issues;
    throw error;
  }
  throw new Error('expected a validation error');
}

describe('parseMatchingRequest', () => {
  it('returns the trimmed description', () => {
    expect(parseMatchingRequest({ description: '  Busco un perro  ' })).toBe('Busco un perro');
  });

  it('accepts exactly the maximum length', () => {
    const text = 'a'.repeat(MATCHING_DESCRIPTION_MAX_LENGTH);
    expect(parseMatchingRequest({ description: text })).toBe(text);
  });

  it.each([
    ['no body', null, 'REQUIRED'],
    ['no description', {}, 'REQUIRED'],
    ['a blank description', { description: '   ' }, 'REQUIRED'],
    ['a non-string description', { description: 5 }, 'INVALID_TYPE'],
    [
      'a description that is too long',
      { description: 'a'.repeat(MATCHING_DESCRIPTION_MAX_LENGTH + 1) },
      'TOO_LONG',
    ],
  ])('rejects %s', (_case, body, code) => {
    expect(issuesOf(() => parseMatchingRequest(body))).toEqual([{ field: 'description', code }]);
  });
});

describe('parseMatchingPreferencesRequest', () => {
  it('accepts a valid partial profile, including an empty one', () => {
    expect(parseMatchingPreferencesRequest({ housingSize: 'SMALL', hasChildren: false })).toEqual({
      housingSize: 'SMALL',
      hasChildren: false,
    });
    expect(parseMatchingPreferencesRequest({})).toEqual({});
  });

  it('rejects values outside the enums and unknown keys, naming each field', () => {
    expect(
      issuesOf(() => parseMatchingPreferencesRequest({ housingSize: 'HUGE', notes: 'hola' })),
    ).toEqual([
      { field: 'housingSize', code: 'INVALID_FORMAT' },
      { field: 'notes', code: 'INVALID_FORMAT' },
    ]);
  });

  it('rejects a body that is not an object', () => {
    expect(issuesOf(() => parseMatchingPreferencesRequest([]))).toEqual([
      { field: 'body', code: 'INVALID_TYPE' },
    ]);
  });
});
