import { AdoptionRequest, type Decision } from '../domain/entities/adoption-request.entity';
import { AdoptionRequestActiveError } from '../domain/errors/adoption-errors';
import type {
  AdoptionRequestFilters,
  AdoptionRequestRepository,
  AdoptionRequestView,
  DecisionOutcome,
} from '../domain/ports/adoption-request-repository';
import type { AnimalStatus } from '../domain/value-objects/adoption-states';

/** Test-only adapter with the same rules as the Prisma one (unique active request, conditions). */
export class InMemoryAdoptionRepository implements AdoptionRequestRepository {
  readonly requests = new Map<string, AdoptionRequest>();
  readonly animals = new Map<string, { name: string; status: AnimalStatus }>();

  async animalStatus(animalId: string): Promise<AnimalStatus | null> {
    return this.animals.get(animalId)?.status ?? null;
  }

  async create(request: AdoptionRequest): Promise<void> {
    const active = [...this.requests.values()].some(
      (other) =>
        other.animalId === request.animalId &&
        other.applicantUserId === request.applicantUserId &&
        (other.status === 'PENDING' || other.status === 'APPROVED'),
    );
    if (active) throw new AdoptionRequestActiveError();
    this.requests.set(request.id, request);
  }

  async findById(id: string): Promise<AdoptionRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async applyDecision(
    requestId: string,
    decision: Decision,
    decidedBy: { userId: string; at: Date },
  ): Promise<DecisionOutcome> {
    const request = this.requests.get(requestId);
    if (!request || request.status !== decision.from) return 'request-changed';
    const animal = this.animals.get(request.animalId);
    if (decision.animal && animal?.status !== decision.animal.from) return 'animal-changed';
    if (decision.animal && animal) animal.status = decision.animal.to;
    this.requests.set(
      requestId,
      AdoptionRequest.reconstitute({
        ...request.props,
        status: decision.to,
        decidedByUserId: decidedBy.userId,
        decidedAt: decidedBy.at,
        updatedAt: decidedBy.at,
      }),
    );
    return 'applied';
  }

  async findView(id: string): Promise<AdoptionRequestView | null> {
    const request = this.requests.get(id);
    return request ? this.view(request) : null;
  }

  async list(
    filters: AdoptionRequestFilters,
    page: { offset: number; limit: number },
  ): Promise<{ items: AdoptionRequestView[]; total: number }> {
    const matching = [...this.requests.values()]
      .filter((request) => !filters.status || request.status === filters.status)
      .filter((request) => !filters.animalId || request.animalId === filters.animalId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: matching.slice(page.offset, page.offset + page.limit).map((r) => this.view(r)),
      total: matching.length,
    };
  }

  private view(request: AdoptionRequest): AdoptionRequestView {
    const animal = this.animals.get(request.animalId) ?? { name: '?', status: 'AVAILABLE' };
    return {
      id: request.id,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      decidedAt: request.decidedAt,
      animal: { id: request.animalId, name: animal.name, status: animal.status },
      applicant: { firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.com' },
    };
  }
}
