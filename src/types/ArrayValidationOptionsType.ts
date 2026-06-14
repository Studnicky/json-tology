import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../types/Validation.js';

/** Options passed to the array-fields validation helper. */
export type ArrayValidationOptionsType = {
  'containsCheck': CheckFnType | undefined;
  'itemValidator': undefined | ValidateWithErrorsFnType;
  'maxContains': number | undefined;
  'maxItems': number | undefined;
  'minContains': number | undefined;
  'minItems': number | undefined;
  'prefixValidators': undefined | ValidateWithErrorsFnType[];
  'uniqueItems': boolean;
};
