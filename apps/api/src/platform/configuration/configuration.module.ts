import { Global, Module } from '@nestjs/common';

import { loadAppConfig } from './app-config';
import { APP_CONFIG } from './configuration.tokens';

/** Validates the environment once, at startup; an invalid configuration stops the boot. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadAppConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigurationModule {}
