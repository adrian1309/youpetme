import { Prisma } from '../../../../../platform/database/generated/client';
import type { PrismaService } from '../../../../../platform/database/prisma.service';
import { AdoptionRequest, type Decision } from '../../../domain/entities/adoption-request.entity';
import { AdoptionRequestActiveError } from '../../../domain/errors/adoption-errors';
import type {
  AdoptionRequestFilters,
  AdoptionRequestRepository,
  AdoptionRequestView,
  DecisionOutcome,
} from '../../../domain/ports/adoption-request-repository';
import type { AnimalStatus } from '../../../domain/value-objects/adoption-states';

/** Partial unique index of the adoption_requests migration (PENDING/APPROVED per user and animal). */
const ACTIVE_REQUEST_INDEX = 'adoption_requests_active_per_user_animal_key';

/** Rolls the decision transaction back, carrying which row had moved. */
class DecisionAborted extends Error {
  constructor(readonly outcome: Exclude<DecisionOutcome, 'applied'>) {
    super(outcome);
  }
}

const VIEW_INCLUDE = {
  animal: { select: { id: true, name: true, status: true } },
  applicant: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
} as const;

type ViewRow = Prisma.AdoptionRequestGetPayload<{ include: typeof VIEW_INCLUDE }>;

/**
 * MVP shortcut: this adapter also reads and updates the `animals` table and reads `users` and
 * `user_profiles`, so a request and its animal always change in the same transaction.
 */
export class PrismaAdoptionRequestRepository implements AdoptionRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async animalStatus(animalId: string): Promise<AnimalStatus | null> {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      select: { status: true },
    });
    return animal?.status ?? null;
  }

  async create(request: AdoptionRequest): Promise<void> {
    try {
      await this.prisma.adoptionRequest.create({ data: { ...request.props } });
    } catch (error) {
      if (isActiveRequestViolation(error)) throw new AdoptionRequestActiveError();
      throw error;
    }
  }

  async findById(id: string): Promise<AdoptionRequest | null> {
    const row = await this.prisma.adoptionRequest.findUnique({ where: { id } });
    return row ? AdoptionRequest.reconstitute(row) : null;
  }

  async applyDecision(
    requestId: string,
    decision: Decision,
    decidedBy: { userId: string; at: Date },
  ): Promise<DecisionOutcome> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const request = await tx.adoptionRequest.findUnique({
          where: { id: requestId },
          select: { animalId: true },
        });
        // Conditional updates: each applies only if its row is still in the expected status.
        const moved = await tx.adoptionRequest.updateMany({
          where: { id: requestId, status: decision.from },
          data: {
            status: decision.to,
            decidedByUserId: decidedBy.userId,
            decidedAt: decidedBy.at,
            updatedAt: decidedBy.at,
          },
        });
        if (!request || moved.count === 0) throw new DecisionAborted('request-changed');

        if (decision.animal) {
          const animal = await tx.animal.updateMany({
            where: { id: request.animalId, status: decision.animal.from },
            data: { status: decision.animal.to, updatedAt: decidedBy.at },
          });
          if (animal.count === 0) throw new DecisionAborted('animal-changed');
        }
      });
      return 'applied';
    } catch (error) {
      if (error instanceof DecisionAborted) return error.outcome;
      throw error;
    }
  }

  async findView(id: string): Promise<AdoptionRequestView | null> {
    const row = await this.prisma.adoptionRequest.findUnique({
      where: { id },
      include: VIEW_INCLUDE,
    });
    return row ? toView(row) : null;
  }

  async list(
    filters: AdoptionRequestFilters,
    page: { offset: number; limit: number },
  ): Promise<{ items: AdoptionRequestView[]; total: number }> {
    const where = { ...filters };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.adoptionRequest.findMany({
        where,
        include: VIEW_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.offset,
        take: page.limit,
      }),
      this.prisma.adoptionRequest.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }
}

function toView(row: ViewRow): AdoptionRequestView {
  return {
    id: row.id,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    animal: row.animal,
    applicant: {
      firstName: row.applicant.profile?.firstName ?? '',
      lastName: row.applicant.profile?.lastName ?? '',
      email: row.applicant.email,
    },
  };
}

/** A unique violation on the partial index (the only unique index of the table besides the id). */
function isActiveRequestViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const meta = error.meta as
    { driverAdapterError?: { cause?: { constraint?: { index?: unknown } } } } | undefined;
  const index = meta?.driverAdapterError?.cause?.constraint?.index;
  return index === undefined || index === ACTIVE_REQUEST_INDEX;
}
