import type { AdoptionRequest, Decision } from '../entities/adoption-request.entity';
import type { AdoptionStatus, AnimalStatus } from '../value-objects/adoption-states';

/** Read model for the ADMIN list and for responses: the request plus minimal animal/applicant. */
export interface AdoptionRequestView {
  id: string;
  status: AdoptionStatus;
  message: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  animal: { id: string; name: string; status: AnimalStatus };
  applicant: { firstName: string; lastName: string; email: string };
}

export interface AdoptionRequestFilters {
  status?: AdoptionStatus;
  animalId?: string;
}

/** Outcome of applying a decision with conditional updates, all or nothing. */
export type DecisionOutcome = 'applied' | 'request-changed' | 'animal-changed';

export interface AdoptionRequestRepository {
  /** null when the animal does not exist. */
  animalStatus(animalId: string): Promise<AnimalStatus | null>;
  /** Throws AdoptionRequestActiveError when the user already has a PENDING/APPROVED one. */
  create(request: AdoptionRequest): Promise<void>;
  findById(id: string): Promise<AdoptionRequest | null>;
  /**
   * In one transaction: the request moves `decision.from → decision.to` and, when the decision
   * has one, the animal `animal.from → animal.to`. Each update only applies if the row is still
   * in its `from` status; otherwise nothing changes and the outcome says which one moved.
   */
  applyDecision(
    requestId: string,
    decision: Decision,
    decidedBy: { userId: string; at: Date },
  ): Promise<DecisionOutcome>;
  findView(id: string): Promise<AdoptionRequestView | null>;
  list(
    filters: AdoptionRequestFilters,
    page: { offset: number; limit: number },
  ): Promise<{ items: AdoptionRequestView[]; total: number }>;
}
