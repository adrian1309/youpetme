import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import type { AppConfig } from '../configuration/app-config';
import { APP_CONFIG } from '../configuration/configuration.tokens';

/**
 * CSRF defence in depth for endpoints that set or read the refresh-token cookie (register, and
 * later refresh and logout), on top of SameSite and the CORS allow-list:
 *
 * - `Origin`, when present, must be exactly WEB_ORIGIN. Browsers always send it on cross-site
 *   POSTs; its absence means a non-browser client (curl, tests, mobile), which is not a CSRF
 *   vector, so it is allowed.
 * - `Content-Type`, when present, must be application/json. A cross-site HTML form cannot send
 *   it without a CORS preflight, which only WEB_ORIGIN passes. A request with no Content-Type
 *   carries no form body.
 *
 * Apply it with `@UseGuards(TrustedBrowserRequestGuard)`; this is the only place the rule lives.
 */
@Injectable()
export class TrustedBrowserRequestGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const { headers } = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();

    const origin = headers.origin;
    if (origin !== undefined && origin !== this.config.webOrigin) {
      throw new ForbiddenException();
    }

    const contentType = headers['content-type'];
    if (contentType !== undefined) {
      const mediaType = contentType.split(';')[0]!.trim().toLowerCase();
      if (mediaType !== 'application/json') {
        throw new UnsupportedMediaTypeException();
      }
    }
    return true;
  }
}
