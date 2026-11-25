import { AdoptionValidationError } from '../errors/adoption-errors';
import { AdoptionRequest, decisionFor } from './adoption-request.entity';

const now = new Date('2026-11-25T10:00:00.000Z');

function submit(message?: string | null) {
  return AdoptionRequest.submit({
    id: '00000000-0000-4000-8000-0000000000d1',
    animalId: '00000000-0000-4000-8000-0000000000a1',
    applicantUserId: '00000000-0000-4000-8000-0000000000u1',
    message,
    now,
  });
}

describe('AdoptionRequest.submit (SCRUM-14, scenario 1)', () => {
  it('creates a PENDING request, undecided, with the trimmed message', () => {
    expect(submit('  I have a garden  ')).toMatchObject({
      status: 'PENDING',
      message: 'I have a garden',
      decidedByUserId: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  it('stores a blank or missing message as null', () => {
    expect(submit('   ').message).toBeNull();
    expect(submit(undefined).message).toBeNull();
  });

  it('rejects a message over the limit with TOO_LONG', () => {
    expect(() => submit('a'.repeat(AdoptionRequest.MESSAGE_MAX_LENGTH + 1))).toThrow(
      expect.objectContaining({ issues: [{ field: 'message', code: 'TOO_LONG' }] }),
    );
    expect(() => submit('a'.repeat(AdoptionRequest.MESSAGE_MAX_LENGTH + 1))).toThrow(
      AdoptionValidationError,
    );
  });
});

describe('decisionFor (SCRUM-15)', () => {
  it.each([
    ['approve', 'PENDING', 'APPROVED', { from: 'AVAILABLE', to: 'RESERVED' }],
    ['reject', 'PENDING', 'REJECTED', null],
    ['complete', 'APPROVED', 'COMPLETED', { from: 'RESERVED', to: 'ADOPTED' }],
    ['cancel', 'APPROVED', 'CANCELLED', { from: 'RESERVED', to: 'AVAILABLE' }],
  ] as const)('%s: %s → %s, with its effect on the animal', (action, from, to, animal) => {
    expect(decisionFor(action, from)).toEqual({ from, to, animal });
  });

  it.each([
    ['approve', 'APPROVED'],
    ['reject', 'APPROVED'],
    ['complete', 'PENDING'],
    ['cancel', 'PENDING'],
    ['approve', 'REJECTED'],
    ['complete', 'COMPLETED'],
    ['cancel', 'CANCELLED'],
  ] as const)('does not allow %s from %s (scenario 6)', (action, from) => {
    expect(decisionFor(action, from)).toBeNull();
  });
});
