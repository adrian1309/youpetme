import type { Animal } from '../../domain/entities/animal.entity';
import type { AnimalFilters, AnimalRepository } from '../../domain/ports/animal-repository';

export interface ListAvailableAnimalsResult {
  items: Animal[];
  total: number;
  page: number;
  pageSize: number;
}

/** SCRUM-12: public catalogue, AVAILABLE animals only. page starts at 1. */
export class ListAvailableAnimalsUseCase {
  constructor(private readonly animals: AnimalRepository) {}

  async execute(query: {
    filters: AnimalFilters;
    page: number;
    pageSize: number;
  }): Promise<ListAvailableAnimalsResult> {
    const { items, total } = await this.animals.listAvailable(query.filters, {
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
