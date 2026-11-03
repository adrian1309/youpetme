import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TermsVersionResponse } from '@youpetme/contracts';

import type { AppConfig } from '../../../../platform/configuration/app-config';
import { APP_CONFIG } from '../../../../platform/configuration/configuration.tokens';

/**
 * Public, read-only: the /terms and /privacy pages show this version, which is the same one
 * RegisterUser stores in `termsVersion` (TS-IAM-001, SCRUM-47).
 */
@ApiTags('legal')
@Controller('legal')
export class TermsVersionController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get('terms-version')
  @ApiOperation({
    summary: 'Current version of the Terms of Service and Privacy Policy (TS-IAM-001)',
    description: 'The value of TERMS_VERSION, recorded as termsVersion when an account is created.',
  })
  @ApiOkResponse({
    description: 'The current version',
    schema: {
      type: 'object',
      required: ['version'],
      properties: { version: { type: 'string', example: '2026-01' } },
    },
  })
  getTermsVersion(): TermsVersionResponse {
    return { version: this.config.termsVersion };
  }
}
