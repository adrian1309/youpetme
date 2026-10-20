import type { INestApplication } from '@nestjs/common';

import { API_GLOBAL_PREFIX, configureApp } from './configure-app';

describe('configureApp', () => {
  it('exposes every REST endpoint under the /api/v1 prefix', () => {
    const app = { setGlobalPrefix: jest.fn() } as unknown as INestApplication;

    configureApp(app);

    expect(API_GLOBAL_PREFIX).toBe('api/v1');
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api/v1');
  });
});
