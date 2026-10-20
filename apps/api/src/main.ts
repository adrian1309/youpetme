import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.API_PORT ?? 3000);
}

void bootstrap();
