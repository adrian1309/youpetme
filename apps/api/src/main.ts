import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { setupOpenApi } from './app/openapi';
import type { AppConfig } from './platform/configuration/app-config';
import { APP_CONFIG } from './platform/configuration/configuration.tokens';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, { webOrigin: config.webOrigin });
  if (process.env.NODE_ENV !== 'production') {
    setupOpenApi(app);
  }
  await app.listen(config.apiPort);
}

void bootstrap();
