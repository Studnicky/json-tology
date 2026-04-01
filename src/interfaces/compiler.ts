import type { ValidationErrorType } from '../types/Validation.js';

export interface CompiledValidationResultInterface {
  'errors': ValidationErrorType[];
  'valid': boolean;
  'value': unknown;
}

export interface CompiledValidatorInterface {
  'check': (data: unknown) => boolean;
  /** True if this is a real compiled validator (not engine fallback) */
  'compiled': boolean;
  'validate': (data: unknown, options?: CompiledValidateOptionsInterface) => CompiledValidationResultInterface;
}

export interface CompiledValidateOptionsInterface {
  'applyDefaults'?: boolean;
  'castTypes'?: boolean;
  'collectErrors'?: boolean;
  'enforceSchemaProperties'?: boolean;
  'removeAdditionalProperties'?: boolean;
}
