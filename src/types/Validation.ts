/**
 * Validation types — expressed as json-tology schemas.
 */

import type { InferType } from './Schema.js';
import type { ValidationErrorSchema } from '../constants/SCHEMAS.js';

export type CheckFnType = (value: unknown) => boolean;

export interface ProblemDetailsErrorEntryType {
  'keyword': string;
  'message': string;
  'params': Record<string, unknown>;
  'path': string;
}


export interface AggregateViewType {
  'count': number;
  'keywords': string[];
  'paths': string[];
}

export interface ProblemDetailsType {
  'detail': string;
  'errors': ProblemDetailsErrorEntryType[];
  'instance'?: string;
  'status': number;
  'title': string;
  'type': string;
}

export type ValidationErrorType = InferType<typeof ValidationErrorSchema>;

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
