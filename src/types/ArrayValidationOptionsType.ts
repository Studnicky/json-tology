import type { ValidateWithErrorsFunctionType } from '../types/Validation.js';

/** Options passed to the array-fields validation helper. */
export type ArrayValidationOptionsType
  = {
    'containsValidator': undefined | ValidateWithErrorsFunctionType;
    'itemValidator': undefined | ValidateWithErrorsFunctionType;
    'maxContains': number | undefined;
    'maxItems': number | undefined;
    'minContains': number | undefined;
    'minItems': number | undefined;
    'prefixValidators': undefined | ValidateWithErrorsFunctionType[];
  }
    & { 'uniqueItems': boolean };
