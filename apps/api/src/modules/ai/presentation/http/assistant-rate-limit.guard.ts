import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { AppConfig } from '../../../../platform/configuration/app-config';
import { APP_CONFIG } from '../../../../platform/configuration/configuration.tokens';

const WINDOW_MS = 60_000;
/** Above this many tracked clients, expired windows are swept on the next request. */
const SWEEP_THRESHOLD = 10_000;

/**
 * Minimum cost and abuse protection for the public chat (Non Functional Requirements — AI usage):
 * a fixed one-minute window per client IP, kept in memory. Per process only, and behind a proxy
 * it needs Express `trust proxy` to see the real IP: enough for the single-instance MVP.
 */
@Injectable()
export class AssistantRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const now = Date.now();
    if (this.windows.size > SWEEP_THRESHOLD) this.sweep(now);

    const key = request.ip ?? 'unknown';
    let window = this.windows.get(key);
    if (!window || now - window.startedAt >= WINDOW_MS) {
      window = { startedAt: now, count: 0 };
      this.windows.set(key, window);
    }
    window.count += 1;
    if (window.count <= this.config.assistant.rateLimitPerMinute) return true;

    const retryAfterSeconds = Math.ceil((window.startedAt + WINDOW_MS - now) / 1000);
    http.getResponse<Response>().setHeader('Retry-After', String(retryAfterSeconds));
    throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= WINDOW_MS) this.windows.delete(key);
    }
  }
}
