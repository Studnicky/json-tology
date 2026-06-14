import type { ValidationErrorType } from '../types/Validation.js';

export type ScalarResultType = {
  readonly 'errors': ValidationErrorType[];
  readonly 'valid': boolean;
};
