import type {
  AdoptionRequestFilters,
  AdoptionRequestRepository,
  AdoptionRequestView,
} from '../../domain/ports/adoption-request-repository';

/** SCRUM-15: the ADMIN lists requests, optionally by status and animal (scenario 5). */
export class ListAdoptionRequestsUseCase {
  constructor(private readonly requests: AdoptionRequestRepository) {}

  async execute(query: {
    filters: AdoptionRequestFilters;
    page: number;
    pageSize: number;
  }): Promise<{ items: AdoptionRequestView[]; total: number; page: number; pageSize: number }> {
    const { items, total } = await this.requests.list(query.filters, {
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
