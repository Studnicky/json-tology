import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';

/** Options passed to the array-fields validation helper. */
export interface ArrayValidationOptionsInterface {
  'containsValidator': undefined | ValidateWithErrorsFunctionInterface;
  'itemValidator': undefined | ValidateWithErrorsFunctionInterface;
  'maxContains': number | undefined;
  'maxItems': number | undefined;
  'minContains': number | undefined;
  'minItems': number | undefined;
  'prefixValidators': undefined | ValidateWithErrorsFunctionInterface[];
  'uniqueItems': BooleanValueEntity.Type;
}
