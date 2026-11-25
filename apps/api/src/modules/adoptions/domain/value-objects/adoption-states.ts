/** Domain Model — AdoptionRequest status. */
export const ADOPTION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];

/** ADMIN actions on a request (SCRUM-15). */
export const ADOPTION_ACTIONS = ['approve', 'reject', 'complete', 'cancel'] as const;
export type AdoptionAction = (typeof ADOPTION_ACTIONS)[number];

/** The animal statuses this module reads and changes (Domain Model — Animal status). */
export type AnimalStatus = 'AVAILABLE' | 'RESERVED' | 'ADOPTED';
