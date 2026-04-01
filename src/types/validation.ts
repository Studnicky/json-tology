/**
 * Validation types — expressed as json-tology schemas.
 */

import type { InferType } from './Schema.js';
import type { ValidationErrorSchema } from '../constants/SCHEMAS.js';

export type ValidationErrorType = InferType<typeof ValidationErrorSchema>;

export type CheckFnType = (value: unknown) => boolean;


export type ValidateWithErrorsFnType = (
  value: unknown,
  path: string,
  errors: ValidationErrorType[],
  collectErrors: boolean,
  applyDefaults: boolean,
  doCoerce: boolean,
  stripUnknown: boolean
) => { 'valid': boolean;
  'value': unknown; };
