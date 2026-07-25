import type {
  OptionalValidateWithErrorsFunctionType, ValidateWithErrorsFunctionType
} from '../types/Validation.js';
import type { InferType } from './Schema.js';
import type { PLAN_ARRAY_VALIDATORS_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Array-related validators compiled for a validation plan node.
 *
 * @remarks
 * Produced once per array schema node during compilation. `itemValidator`
 * applies to every element; `prefixValidators` applies positionally to tuple
 * items; `containsValidator` tests whether at least one element satisfies the
 * `contains` sub-schema, run in check-mode isolation. All fields are `undefined`
 * when the corresponding keyword is absent.
 *
 * @example
 * ```ts
 * const arrayVals: PlanArrayValidatorsType = {
 *   itemValidator: validateString,
 *   prefixValidators: [validateId, validateName],
 *   containsValidator: validateNonEmpty,
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link CompositionValidatorsResultType}
 * @group Validation
 */
export type PlanArrayValidatorsType = InferType<typeof PLAN_ARRAY_VALIDATORS_SCHEMA> & {
  'containsValidator': OptionalValidateWithErrorsFunctionType;
  'itemValidator': OptionalValidateWithErrorsFunctionType;
  'prefixValidators': undefined | ValidateWithErrorsFunctionType[];
};
