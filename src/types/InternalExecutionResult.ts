import type { ValidationErrorType } from '../types/Validation.js';

export type InternalExecutionResultType = {
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number> | undefined;
  'evaluatedProperties': Set<string> | undefined;
  'valid': boolean;
  'value': unknown;
};
