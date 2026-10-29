import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { API_GLOBAL_PREFIX } from './configure-app';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('YouPetMe API')
    .setDescription('REST API of the YouPetMe animal adoption platform')
    .setVersion('1')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Swagger UI is only served outside production (ARCH-002). */
export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(`${API_GLOBAL_PREFIX}/docs`, app, buildOpenApiDocument(app));
}
