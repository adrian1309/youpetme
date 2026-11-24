import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AGE_GROUPS,
  type AnimalDetail,
  type ListAnimalsResponse,
  SIZES,
  SPECIES,
  TEMPERAMENTS,
} from '@youpetme/contracts';

import { AccessTokenGuard } from '../../../iam/presentation/http/access-token.guard';
import type { GetAnimalUseCase } from '../../application/use-cases/get-animal.use-case';
import type { ListAvailableAnimalsUseCase } from '../../application/use-cases/list-available-animals.use-case';
import type { RegisterAnimalUseCase } from '../../application/use-cases/register-animal.use-case';
import {
  GET_ANIMAL_USE_CASE,
  LIST_AVAILABLE_ANIMALS_USE_CASE,
  REGISTER_ANIMAL_USE_CASE,
} from '../../animals.tokens';
import { AnimalNotFoundError } from '../../domain/errors/animal-not-found.error';
import { AnimalValidationError } from '../../domain/errors/animal-validation.error';
import { AdminGuard } from './admin.guard';
import { AnimalsExceptionFilter } from './animals-exception.filter';
import { isUuid, parseCatalogueQuery, parseCreateAnimalBody } from './animals.request';
import { toAnimalDetail, toAnimalSummary } from './animals.presenter';

@ApiTags('animals')
@Controller('animals')
@UseFilters(AnimalsExceptionFilter)
export class AnimalsController {
  constructor(
    @Inject(REGISTER_ANIMAL_USE_CASE) private readonly registerAnimal: RegisterAnimalUseCase,
    @Inject(LIST_AVAILABLE_ANIMALS_USE_CASE)
    private readonly listAvailable: ListAvailableAnimalsUseCase,
    @Inject(GET_ANIMAL_USE_CASE) private readonly getAnimal: GetAnimalUseCase,
  ) {}

  @Post()
  @UseGuards(AccessTokenGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register an animal, AVAILABLE in the MVP shelter (SCRUM-10, ADMIN only)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'species', 'size', 'ageGroup', 'photoUrls'],
      properties: {
        name: { type: 'string', maxLength: 100 },
        species: { type: 'string', enum: [...SPECIES] },
        size: { type: 'string', enum: [...SIZES] },
        ageGroup: { type: 'string', enum: [...AGE_GROUPS] },
        photoUrls: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: { type: 'string', format: 'uri', description: 'https only' },
        },
        breed: { type: 'string', nullable: true, maxLength: 100 },
        temperament: { type: 'array', items: { type: 'string', enum: [...TEMPERAMENTS] } },
        compatibleWithChildren: { type: 'boolean', nullable: true },
        compatibleWithOtherAnimals: { type: 'boolean', nullable: true },
        careNotes: { type: 'string', nullable: true, maxLength: 2000 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Animal created' })
  @ApiResponse({ status: 400, description: 'Invalid input; `details` lists each failing field' })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired access token' })
  @ApiResponse({ status: 403, description: 'The user is not an ADMIN' })
  @HttpCode(201)
  async create(@Body() body: unknown): Promise<AnimalDetail> {
    const parsed = parseCreateAnimalBody(body);
    if (!parsed.ok) throw new AnimalValidationError(parsed.issues);
    return toAnimalDetail(await this.registerAnimal.execute(parsed.value));
  }

  @Get()
  @ApiOperation({ summary: 'Public catalogue: AVAILABLE animals, newest first (SCRUM-12)' })
  @ApiQuery({ name: 'species', required: false, enum: [...SPECIES] })
  @ApiQuery({ name: 'size', required: false, enum: [...SIZES] })
  @ApiQuery({ name: 'ageGroup', required: false, enum: [...AGE_GROUPS] })
  @ApiQuery({ name: 'compatibleWithChildren', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'compatibleWithOtherAnimals', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'From 1' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: '1 to 50, default 12' })
  @ApiResponse({ status: 200, description: 'One page of animal cards' })
  @ApiResponse({ status: 400, description: 'A filter or page value is not allowed' })
  async list(@Query() query: Record<string, unknown>): Promise<ListAnimalsResponse> {
    const parsed = parseCatalogueQuery(query);
    if (!parsed.ok) throw new AnimalValidationError(parsed.issues);
    const result = await this.listAvailable.execute(parsed.value);
    return {
      items: result.items.map(toAnimalSummary),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public detail of an animal, whatever its status (SCRUM-13)' })
  @ApiResponse({ status: 200, description: 'The animal' })
  @ApiResponse({ status: 404, description: 'Unknown or malformed id' })
  async detail(@Param('id') id: string): Promise<AnimalDetail> {
    if (!isUuid(id)) throw new AnimalNotFoundError();
    return toAnimalDetail(await this.getAnimal.execute(id));
  }
}
