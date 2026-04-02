import type { ValidationErrorType } from '../types/Validation.js';

export interface ArrayResultInterface {
  readonly 'errors': ValidationErrorType[];
  readonly 'valid': boolean;
  readonly 'value': unknown[];
}
