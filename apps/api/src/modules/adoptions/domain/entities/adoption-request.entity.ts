import { AdoptionValidationError } from '../errors/adoption-errors';
import type {
  AdoptionAction,
  AdoptionStatus,
  AnimalStatus,
} from '../value-objects/adoption-states';

export interface AdoptionRequestProps {
  id: string;
  animalId: string;
  applicantUserId: string;
  message: string | null;
  status: AdoptionStatus;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What an ADMIN action does: the request's change and, if any, the animal's (same transaction). */
export interface Decision {
  from: AdoptionStatus;
  to: AdoptionStatus;
  animal: { from: AnimalStatus; to: AnimalStatus } | null;
}

/** Domain Model — allowed transitions. Anything else is not allowed (SCRUM-15, scenario 6). */
const DECISIONS: Record<AdoptionAction, Decision> = {
  approve: { from: 'PENDING', to: 'APPROVED', animal: { from: 'AVAILABLE', to: 'RESERVED' } },
  reject: { from: 'PENDING', to: 'REJECTED', animal: null },
  complete: { from: 'APPROVED', to: 'COMPLETED', animal: { from: 'RESERVED', to: 'ADOPTED' } },
  cancel: { from: 'APPROVED', to: 'CANCELLED', animal: { from: 'RESERVED', to: 'AVAILABLE' } },
};

/** The decision for `action` on a request in `status`, or null when it is not allowed. */
export function decisionFor(action: AdoptionAction, status: AdoptionStatus): Decision | null {
  const decision = DECISIONS[action];
  return decision.from === status ? decision : null;
}

export class AdoptionRequest {
  static readonly MESSAGE_MAX_LENGTH = 1000;

  private constructor(readonly props: AdoptionRequestProps) {}

  /** SCRUM-14: a new PENDING request. Throws AdoptionValidationError. */
  static submit(input: {
    id: string;
    animalId: string;
    applicantUserId: string;
    message?: string | null;
    now: Date;
  }): AdoptionRequest {
    const message = input.message?.trim() || null;
    if (message && message.length > AdoptionRequest.MESSAGE_MAX_LENGTH) {
      throw new AdoptionValidationError([{ field: 'message', code: 'TOO_LONG' }]);
    }
    return new AdoptionRequest({
      id: input.id,
      animalId: input.animalId,
      applicantUserId: input.applicantUserId,
      message,
      status: 'PENDING',
      decidedByUserId: null,
      decidedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static reconstitute(props: AdoptionRequestProps): AdoptionRequest {
    return new AdoptionRequest({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get animalId(): string {
    return this.props.animalId;
  }
  get applicantUserId(): string {
    return this.props.applicantUserId;
  }
  get message(): string | null {
    return this.props.message;
  }
  get status(): AdoptionStatus {
    return this.props.status;
  }
  get decidedByUserId(): string | null {
    return this.props.decidedByUserId;
  }
  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
