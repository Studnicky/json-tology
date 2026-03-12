import type { ValidationErrorType } from '../types/validation.js';

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
  'coerce'?: boolean;
  'collectErrors'?: boolean;
  'removeAdditional'?: boolean;
  'stripUnknownProperties'?: boolean;
}
