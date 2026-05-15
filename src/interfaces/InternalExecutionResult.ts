import type { ValidationErrorType } from '../types/Validation.js';

export interface InternalExecutionResultInterface {
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number> | undefined;
  'evaluatedProperties': Set<string> | undefined;
  'valid': boolean;
  'value': unknown;
}
