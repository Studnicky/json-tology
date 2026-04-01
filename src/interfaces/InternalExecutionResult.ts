import type { ValidationErrorType } from '../types/Validation.js';

export interface InternalExecutionResultInterface {
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number>;
  'evaluatedProperties': Set<string>;
  'valid': boolean;
  'value': unknown;
}
