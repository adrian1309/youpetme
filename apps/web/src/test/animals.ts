import type {
  AnimalDetail,
  AnimalSummary,
  ListAnimalsResponse,
  RefreshResponse,
} from '@youpetme/contracts';

import { jsonResponse, TEST_API_URL } from './render-with-providers';

export const LUNA_ID = '00000000-0000-4000-8000-0000000000a1';

export function summary(overrides: Partial<AnimalSummary> = {}): AnimalSummary {
  return {
    id: LUNA_ID,
    name: 'Luna',
    species: 'DOG',
    size: 'MEDIUM',
    ageGroup: 'ADULT',
    temperament: ['CALM'],
    compatibleWithChildren: true,
    compatibleWithOtherAnimals: null,
    photoUrl: 'https://images.example.com/luna.jpg',
    ...overrides,
  };
}

export function detail(overrides: Partial<AnimalDetail> = {}): AnimalDetail {
  return {
    id: LUNA_ID,
    name: 'Luna',
    species: 'DOG',
    size: 'MEDIUM',
    ageGroup: 'ADULT',
    breed: 'Labrador',
    temperament: ['CALM', 'AFFECTIONATE'],
    compatibleWithChildren: true,
    compatibleWithOtherAnimals: false,
    careNotes: 'Necesita un jardín.',
    photoUrls: ['https://images.example.com/luna.jpg'],
    status: 'AVAILABLE',
    createdAt: '2026-11-24T10:00:00.000Z',
    ...overrides,
  };
}

export function page(items: AnimalSummary[], overrides: Partial<ListAnimalsResponse> = {}) {
  return { items, page: 1, pageSize: 12, total: items.length, ...overrides };
}

export function signedInAs(role: 'USER' | 'ADMIN'): RefreshResponse {
  return {
    user: {
      id: 'u-1',
      firstName: 'Ana',
      lastName: 'Ruiz',
      email: 'ana@example.com',
      status: 'ACTIVE',
      role,
    },
    authentication: { accessToken: `${role.toLowerCase()}-token` },
  };
}

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/**
 * A fake fetch that routes by method and path. The refresh call answers 401 (visitor) unless a
 * session is given, so pages can be rendered like the real app with `auth: 'restore'`.
 */
export function fakeApi(
  routes: Record<string, Handler>,
  session: RefreshResponse | null = null,
): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), TEST_API_URL);
    const key = `${init?.method ?? 'GET'} ${url.pathname}`;
    if (key === 'POST /api/v1/auth/refresh') {
      return session
        ? jsonResponse(200, session)
        : jsonResponse(401, { statusCode: 401, error: 'Unauthorized', message: 'x' });
    }
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    return handler(url, init);
  });
}
