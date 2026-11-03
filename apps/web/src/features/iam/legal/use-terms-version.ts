import { useQuery } from '@tanstack/react-query';
import type { TermsVersionResponse } from '@youpetme/contracts';

import { useApiClient } from '../../../lib/http/api-client-context';

const TERMS_VERSION_PATH = '/api/v1/legal/terms-version';

/**
 * The version the server records as `termsVersion` on registration (TS-IAM-001). The pages read
 * it from the API instead of keeping their own copy, so both always show the same value
 * (SCRUM-47).
 */
export function useTermsVersion() {
  const client = useApiClient();

  return useQuery({
    queryKey: ['legal', 'terms-version'],
    queryFn: () => client.get<TermsVersionResponse>(TERMS_VERSION_PATH),
    select: (response) => response.version,
  });
}
