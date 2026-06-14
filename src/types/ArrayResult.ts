import type { ValidationErrorType } from '../types/Validation.js';

export type ArrayResultType = {
  readonly 'errors': ValidationErrorType[];
  readonly 'valid': boolean;
  readonly 'value': unknown[];
};
