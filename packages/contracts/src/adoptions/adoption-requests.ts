import type { AnimalStatus } from '../animals/animals';

/** Domain Model — AdoptionRequest. */
export const ADOPTION_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type AdoptionRequestStatus = (typeof ADOPTION_REQUEST_STATUSES)[number];

/** ADMIN actions, one route each: POST /api/v1/adoption-requests/:id/<action>. */
export const ADOPTION_REQUEST_ACTIONS = ['approve', 'reject', 'complete', 'cancel'] as const;
export type AdoptionRequestAction = (typeof ADOPTION_REQUEST_ACTIONS)[number];

/** Allowed actions per status; any other is a 409. Clients use it to show only valid buttons. */
export const ADOPTION_REQUEST_ACTIONS_BY_STATUS: Record<
  AdoptionRequestStatus,
  readonly AdoptionRequestAction[]
> = {
  PENDING: ['approve', 'reject'],
  APPROVED: ['complete', 'cancel'],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

/** Maximum length of the optional message, once trimmed. */
export const ADOPTION_MESSAGE_MAX_LENGTH = 1000;

export const ADOPTION_REQUESTS_PAGE_SIZE_DEFAULT = 12;
export const ADOPTION_REQUESTS_PAGE_SIZE_MAX = 50;

/** POST /api/v1/adoption-requests (any authenticated user). The animal must be AVAILABLE. */
export interface CreateAdoptionRequest {
  animalId: string;
  message?: string | null;
}

/** One adoption request, with what the ADMIN needs to manage it. */
export interface AdoptionRequestItem {
  id: string;
  status: AdoptionRequestStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  animal: { id: string; name: string; status: AnimalStatus };
  applicant: { firstName: string; lastName: string; email: string };
}

/** GET /api/v1/adoption-requests (ADMIN only), newest first. Filters are optional (AND). */
export interface ListAdoptionRequestsQuery {
  status?: AdoptionRequestStatus;
  animalId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAdoptionRequestsResponse {
  items: AdoptionRequestItem[];
  page: number;
  pageSize: number;
  total: number;
}
