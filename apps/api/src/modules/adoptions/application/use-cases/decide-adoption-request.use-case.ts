import { decisionFor } from '../../domain/entities/adoption-request.entity';
import {
  AdoptionRequestNotFoundError,
  AnimalNotAvailableError,
  TransitionNotAllowedError,
} from '../../domain/errors/adoption-errors';
import type {
  AdoptionRequestRepository,
  AdoptionRequestView,
} from '../../domain/ports/adoption-request-repository';
import type { Clock } from '../../domain/ports/clock-and-ids';
import type { AdoptionAction } from '../../domain/value-objects/adoption-states';

/**
 * SCRUM-15: the ADMIN approves, rejects, completes or cancels a request. The request and its
 * animal change together, and only if neither moved meanwhile (two admins at once).
 */
export class DecideAdoptionRequestUseCase {
  constructor(
    private readonly requests: AdoptionRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: {
    requestId: string;
    action: AdoptionAction;
    adminUserId: string;
  }): Promise<AdoptionRequestView> {
    const request = await this.requests.findById(command.requestId);
    if (!request) throw new AdoptionRequestNotFoundError();

    const decision = decisionFor(command.action, request.status);
    if (!decision) throw new TransitionNotAllowedError();

    const outcome = await this.requests.applyDecision(request.id, decision, {
      userId: command.adminUserId,
      at: this.clock.now(),
    });
    if (outcome === 'animal-changed' && command.action === 'approve') {
      throw new AnimalNotAvailableError();
    }
    if (outcome !== 'applied') throw new TransitionNotAllowedError();

    return (await this.requests.findView(request.id))!;
  }
}
