import { type ExecutionContext, ForbiddenException } from '@nestjs/common';

import { AccessTokenGuard } from '../../../iam/presentation/http/access-token.guard';
import { AdminGuard } from './admin.guard';

async function contextFor(role: 'USER' | 'ADMIN'): Promise<ExecutionContext> {
  const request = { headers: { authorization: 'Bearer token' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  // The real AccessTokenGuard attaches the verified user, as it does before AdminGuard runs.
  await new AccessTokenGuard({
    verify: async () => ({ userId: 'u', sessionId: 's', role }),
  }).canActivate(context);
  return context;
}

describe('AdminGuard', () => {
  it('lets an ADMIN through', async () => {
    expect(new AdminGuard().canActivate(await contextFor('ADMIN'))).toBe(true);
  });

  it('rejects any other role with a 403', async () => {
    const context = await contextFor('USER');
    expect(() => new AdminGuard().canActivate(context)).toThrow(ForbiddenException);
  });
});
