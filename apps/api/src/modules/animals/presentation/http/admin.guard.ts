import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { authenticatedUserOf } from '../../../iam/presentation/http/access-token.guard';

/**
 * Only the ADMIN role passes (role claim of the access token, ADR-002). Must run after
 * AccessTokenGuard, which answers 401 when there is no valid token; any other role gets a 403.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = authenticatedUserOf(context.switchToHttp().getRequest<object>());
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    return true;
  }
}
