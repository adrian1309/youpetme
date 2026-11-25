import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ADOPTION_MESSAGE_MAX_LENGTH,
  ADOPTION_REQUEST_ACTIONS,
  ADOPTION_REQUEST_STATUSES,
  type AdoptionRequestItem,
  type ListAdoptionRequestsResponse,
} from '@youpetme/contracts';

import { AdminGuard } from '../../../animals/presentation/http/admin.guard';
import {
  AccessTokenGuard,
  authenticatedUserOf,
} from '../../../iam/presentation/http/access-token.guard';
import type { DecideAdoptionRequestUseCase } from '../../application/use-cases/decide-adoption-request.use-case';
import type { ListAdoptionRequestsUseCase } from '../../application/use-cases/list-adoption-requests.use-case';
import type { SubmitAdoptionRequestUseCase } from '../../application/use-cases/submit-adoption-request.use-case';
import {
  DECIDE_ADOPTION_REQUEST_USE_CASE,
  LIST_ADOPTION_REQUESTS_USE_CASE,
  SUBMIT_ADOPTION_REQUEST_USE_CASE,
} from '../../adoptions.tokens';
import {
  AdoptionRequestNotFoundError,
  AdoptionValidationError,
} from '../../domain/errors/adoption-errors';
import { toAdoptionRequestItem } from './adoption-requests.presenter';
import { isAction, isUuid, parseListQuery, parseSubmitBody } from './adoption-requests.request';
import { AdoptionsExceptionFilter } from './adoptions-exception.filter';

/**
 * Bearer-authenticated endpoints: no refresh cookie is involved, so TrustedBrowserRequestGuard
 * (ADR-002, cookie endpoints only) does not apply, as with POST /animals.
 */
@ApiTags('adoption-requests')
@ApiBearerAuth()
@Controller('adoption-requests')
@UseGuards(AccessTokenGuard)
@UseFilters(AdoptionsExceptionFilter)
export class AdoptionRequestsController {
  constructor(
    @Inject(SUBMIT_ADOPTION_REQUEST_USE_CASE)
    private readonly submitRequest: SubmitAdoptionRequestUseCase,
    @Inject(LIST_ADOPTION_REQUESTS_USE_CASE)
    private readonly listRequests: ListAdoptionRequestsUseCase,
    @Inject(DECIDE_ADOPTION_REQUEST_USE_CASE)
    private readonly decideRequest: DecideAdoptionRequestUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Ask to adopt an AVAILABLE animal; the request is PENDING (SCRUM-14)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['animalId'],
      properties: {
        animalId: { type: 'string', format: 'uuid' },
        message: { type: 'string', nullable: true, maxLength: ADOPTION_MESSAGE_MAX_LENGTH },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Request created (PENDING)' })
  @ApiResponse({ status: 400, description: 'Invalid input; `details` lists each failing field' })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired access token' })
  @ApiResponse({ status: 404, description: 'Unknown animal' })
  @ApiResponse({
    status: 409,
    description: '`ANIMAL_NOT_AVAILABLE` or `ADOPTION_REQUEST_ACTIVE` (already PENDING/APPROVED)',
  })
  async submit(@Body() body: unknown, @Req() request: object): Promise<AdoptionRequestItem> {
    const parsed = parseSubmitBody(body);
    if (!parsed.ok) throw new AdoptionValidationError(parsed.issues);
    const view = await this.submitRequest.execute({
      ...parsed.value,
      applicantUserId: authenticatedUserOf(request).userId,
    });
    return toAdoptionRequestItem(view);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'List adoption requests, newest first (SCRUM-15, ADMIN only)' })
  @ApiQuery({ name: 'status', required: false, enum: [...ADOPTION_REQUEST_STATUSES] })
  @ApiQuery({ name: 'animalId', required: false, description: 'UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'From 1' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: '1 to 50, default 12' })
  @ApiResponse({ status: 200, description: 'One page of requests' })
  @ApiResponse({ status: 400, description: 'A filter or page value is not allowed' })
  @ApiResponse({ status: 403, description: 'The user is not an ADMIN' })
  async list(@Query() query: Record<string, unknown>): Promise<ListAdoptionRequestsResponse> {
    const parsed = parseListQuery(query);
    if (!parsed.ok) throw new AdoptionValidationError(parsed.issues);
    const result = await this.listRequests.execute(parsed.value);
    return {
      items: result.items.map(toAdoptionRequestItem),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  @Post(':id/:action')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Approve, reject, complete or cancel a request (SCRUM-15, ADMIN only)',
    description:
      'PENDING → approve (animal RESERVED) | reject; APPROVED → complete (animal ADOPTED) | cancel (animal AVAILABLE).',
  })
  @ApiParam({ name: 'action', enum: [...ADOPTION_REQUEST_ACTIONS] })
  @ApiResponse({ status: 200, description: 'The request after the change' })
  @ApiResponse({ status: 403, description: 'The user is not an ADMIN' })
  @ApiResponse({ status: 404, description: 'Unknown request or action' })
  @ApiResponse({
    status: 409,
    description:
      'Not allowed from the current status, or changed meanwhile (no `code`); `ANIMAL_NOT_AVAILABLE` when approving',
  })
  async decide(
    @Param('id') id: string,
    @Param('action') action: string,
    @Req() request: object,
  ): Promise<AdoptionRequestItem> {
    if (!isUuid(id) || !isAction(action)) throw new AdoptionRequestNotFoundError();
    const view = await this.decideRequest.execute({
      requestId: id,
      action,
      adminUserId: authenticatedUserOf(request).userId,
    });
    return toAdoptionRequestItem(view);
  }
}
