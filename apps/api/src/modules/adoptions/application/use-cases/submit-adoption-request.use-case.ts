import { AdoptionRequest } from '../../domain/entities/adoption-request.entity';
import {
  AdoptionAnimalNotFoundError,
  AnimalNotAvailableError,
} from '../../domain/errors/adoption-errors';
import type {
  AdoptionRequestRepository,
  AdoptionRequestView,
} from '../../domain/ports/adoption-request-repository';
import type { Clock, IdGenerator } from '../../domain/ports/clock-and-ids';

/** SCRUM-14: any authenticated user asks to adopt an AVAILABLE animal; the request is PENDING. */
export class SubmitAdoptionRequestUseCase {
  constructor(
    private readonly requests: AdoptionRequestRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: {
    animalId: string;
    applicantUserId: string;
    message?: string | null;
  }): Promise<AdoptionRequestView> {
    const request = AdoptionRequest.submit({
      ...command,
      id: this.ids.next(),
      now: this.clock.now(),
    });

    const animalStatus = await this.requests.animalStatus(command.animalId);
    if (animalStatus === null) throw new AdoptionAnimalNotFoundError();
    if (animalStatus !== 'AVAILABLE') throw new AnimalNotAvailableError();

    // The partial unique index decides duplicates, also under concurrency (scenario 4).
    await this.requests.create(request);
    return (await this.requests.findView(request.id))!;
  }
}
