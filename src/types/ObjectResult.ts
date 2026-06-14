import type { ValidationErrorType } from '../types/Validation.js';

export type ObjectResultType = {
  readonly 'errors': ValidationErrorType[];
  readonly 'valid': boolean;
  readonly 'value': Record<string, unknown>;
};
