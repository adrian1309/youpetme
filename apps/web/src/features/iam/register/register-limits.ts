import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@youpetme/contracts';

/** Interpolation values for the validation copy, so no limit is hard-coded in es.json. */
export const REGISTER_LIMITS = {
  min: PASSWORD_MIN_LENGTH,
  max: PASSWORD_MAX_LENGTH,
  nameMax: NAME_MAX_LENGTH,
  emailMax: EMAIL_MAX_LENGTH,
} as const;
