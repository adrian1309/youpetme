import type { INestApplication } from '@nestjs/common';

/** Every REST endpoint is versioned under this prefix (ARCH-001). */
export const API_GLOBAL_PREFIX = 'api/v1';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
}
