import {
  AnimalValidationError,
  type AnimalValidationIssue,
} from '../errors/animal-validation.error';
import {
  AGE_GROUPS,
  type AgeGroup,
  type AnimalStatus,
  isOneOf,
  SIZES,
  type Size,
  SPECIES,
  type Species,
  TEMPERAMENTS,
  type Temperament,
} from '../value-objects/taxonomy';

/** Raw values as received; the taxonomy is checked here (Domain Model — Taxonomy). */
export interface NewAnimalInput {
  id: string;
  shelterId: string;
  now: Date;
  name: string;
  species: string;
  size: string;
  ageGroup: string;
  photoUrls: readonly string[];
  breed?: string | null;
  temperament?: readonly string[];
  compatibleWithChildren?: boolean | null;
  compatibleWithOtherAnimals?: boolean | null;
  careNotes?: string | null;
}

export interface AnimalProps {
  id: string;
  shelterId: string;
  name: string;
  species: Species;
  size: Size;
  ageGroup: AgeGroup;
  breed: string | null;
  temperament: Temperament[];
  compatibleWithChildren: boolean | null;
  compatibleWithOtherAnimals: boolean | null;
  careNotes: string | null;
  photoUrls: string[];
  status: AnimalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Animal {
  static readonly NAME_MAX_LENGTH = 100;
  static readonly BREED_MAX_LENGTH = 100;
  static readonly CARE_NOTES_MAX_LENGTH = 2000;
  static readonly PHOTO_URL_MAX_LENGTH = 2048;
  static readonly PHOTOS_MAX = 5;

  private constructor(private readonly props: AnimalProps) {}

  /** Registers a new animal (SCRUM-10): always AVAILABLE. Throws AnimalValidationError. */
  static register(input: NewAnimalInput): Animal {
    const issues: AnimalValidationIssue[] = [];

    const name = input.name.trim();
    if (!name) issues.push({ field: 'name', code: 'REQUIRED' });
    else if (name.length > Animal.NAME_MAX_LENGTH) issues.push({ field: 'name', code: 'TOO_LONG' });

    const species = checkEnum('species', input.species, SPECIES, issues);
    const size = checkEnum('size', input.size, SIZES, issues);
    const ageGroup = checkEnum('ageGroup', input.ageGroup, AGE_GROUPS, issues);

    const temperament = [...new Set(input.temperament ?? [])];
    if (!temperament.every((tag) => isOneOf(TEMPERAMENTS, tag))) {
      issues.push({ field: 'temperament', code: 'INVALID_FORMAT' });
    }

    const breed = optionalText('breed', input.breed, Animal.BREED_MAX_LENGTH, issues);
    const careNotes = optionalText(
      'careNotes',
      input.careNotes,
      Animal.CARE_NOTES_MAX_LENGTH,
      issues,
    );

    const photoUrls = input.photoUrls.map((url) => url.trim());
    if (photoUrls.length === 0) issues.push({ field: 'photoUrls', code: 'REQUIRED' });
    else if (photoUrls.length > Animal.PHOTOS_MAX) {
      issues.push({ field: 'photoUrls', code: 'TOO_LONG' });
    } else if (!photoUrls.every(isHttpsUrl)) {
      issues.push({ field: 'photoUrls', code: 'INVALID_FORMAT' });
    }

    if (issues.length > 0) throw new AnimalValidationError(issues);

    return new Animal({
      id: input.id,
      shelterId: input.shelterId,
      name,
      species: species!,
      size: size!,
      ageGroup: ageGroup!,
      breed,
      temperament: temperament as Temperament[],
      compatibleWithChildren: input.compatibleWithChildren ?? null,
      compatibleWithOtherAnimals: input.compatibleWithOtherAnimals ?? null,
      careNotes,
      photoUrls,
      status: 'AVAILABLE',
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static reconstitute(props: AnimalProps): Animal {
    return new Animal({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get shelterId(): string {
    return this.props.shelterId;
  }
  get name(): string {
    return this.props.name;
  }
  get species(): Species {
    return this.props.species;
  }
  get size(): Size {
    return this.props.size;
  }
  get ageGroup(): AgeGroup {
    return this.props.ageGroup;
  }
  get breed(): string | null {
    return this.props.breed;
  }
  get temperament(): Temperament[] {
    return [...this.props.temperament];
  }
  get compatibleWithChildren(): boolean | null {
    return this.props.compatibleWithChildren;
  }
  get compatibleWithOtherAnimals(): boolean | null {
    return this.props.compatibleWithOtherAnimals;
  }
  get careNotes(): string | null {
    return this.props.careNotes;
  }
  get photoUrls(): string[] {
    return [...this.props.photoUrls];
  }
  get status(): AnimalStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function checkEnum<T extends string>(
  field: string,
  value: string,
  allowed: readonly T[],
  issues: AnimalValidationIssue[],
): T | undefined {
  if (!value) {
    issues.push({ field, code: 'REQUIRED' });
    return undefined;
  }
  if (!isOneOf(allowed, value)) {
    issues.push({ field, code: 'INVALID_FORMAT' });
    return undefined;
  }
  return value;
}

/** Blank becomes null (not provided). */
function optionalText(
  field: string,
  value: string | null | undefined,
  max: number,
  issues: AnimalValidationIssue[],
): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.length > max) issues.push({ field, code: 'TOO_LONG' });
  return trimmed;
}

function isHttpsUrl(value: string): boolean {
  if (value.length > Animal.PHOTO_URL_MAX_LENGTH) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
