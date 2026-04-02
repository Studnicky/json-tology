import type { ValidationErrorType } from '../types/Validation.js';

export interface ObjectResultInterface {
  readonly 'errors': ValidationErrorType[];
  readonly 'valid': boolean;
  readonly 'value': Record<string, unknown>;
}
