import type { ValidateWithErrorsFnType } from '../types/Validation.js';

/** Options passed to the array-fields validation helper. */
export type ArrayValidationOptionsType = {
  'containsValidator': undefined | ValidateWithErrorsFnType;
  'itemValidator': undefined | ValidateWithErrorsFnType;
  'maxContains': number | undefined;
  'maxItems': number | undefined;
  'minContains': number | undefined;
  'minItems': number | undefined;
  'prefixValidators': undefined | ValidateWithErrorsFnType[];
  'uniqueItems': boolean;
};
