import type { INestApplication } from '@nestjs/common';

import { API_GLOBAL_PREFIX, configureApp } from './configure-app';

function fakeApp() {
  const express = { disable: jest.fn() };
  return {
    setGlobalPrefix: jest.fn(),
    enableCors: jest.fn(),
    getHttpAdapter: () => ({ getInstance: () => express }),
    express,
  };
}

describe('configureApp', () => {
  it('exposes every REST endpoint under the /api/v1 prefix', () => {
    const app = fakeApp();

    configureApp(app as unknown as INestApplication);

    expect(API_GLOBAL_PREFIX).toBe('api/v1');
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api/v1');
  });

  it('restricts CORS to the configured web origin, with credentials for the refresh cookie', () => {
    const app = fakeApp();

    configureApp(app as unknown as INestApplication, { webOrigin: 'http://localhost:5173' });

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: 'http://localhost:5173',
      credentials: true,
    });
  });

  it('does not enable CORS when no web origin is configured', () => {
    const app = fakeApp();

    configureApp(app as unknown as INestApplication);

    expect(app.enableCors).not.toHaveBeenCalled();
  });

  it('does not advertise the framework through the X-Powered-By header', () => {
    const app = fakeApp();

    configureApp(app as unknown as INestApplication);

    expect(app.express.disable).toHaveBeenCalledWith('x-powered-by');
  });
});
