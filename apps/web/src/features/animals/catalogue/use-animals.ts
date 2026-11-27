import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ListAnimalsResponse } from '@youpetme/contracts';

import { useApiClient } from '../../../lib/http/api-client-context';
import { ANIMALS_PATH } from '../animal-tags';

/** Public list of AVAILABLE animals for a query string (catalogue filters and page). */
export function useAnimals(queryString: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: ['animals', queryString],
    queryFn: ({ signal }) =>
      client.get<ListAnimalsResponse>(`${ANIMALS_PATH}${queryString ? `?${queryString}` : ''}`, {
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}
