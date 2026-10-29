import type { INestApplication } from '@nestjs/common';

/** Every REST endpoint is versioned under this prefix (ARCH-001). */
export const API_GLOBAL_PREFIX = 'api/v1';

export interface ConfigureAppOptions {
  /** The only browser origin allowed to call the API (WEB_ORIGIN, ARCH-002). */
  webOrigin?: string;
}

export function configureApp(app: INestApplication, options: ConfigureAppOptions = {}): void {
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  // Do not advertise the framework to clients.
  (app.getHttpAdapter().getInstance() as { disable(setting: string): void }).disable(
    'x-powered-by',
  );
  if (options.webOrigin) {
    app.enableCors({ origin: options.webOrigin, credentials: true });
  }
}
