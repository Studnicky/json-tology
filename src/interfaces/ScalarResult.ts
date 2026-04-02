import type { ValidationErrorType } from '../types/Validation.js';

export interface ScalarResultInterface {
  readonly 'errors': ValidationErrorType[];
  readonly 'valid': boolean;
}
