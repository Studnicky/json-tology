import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';

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
 * const arrayVals: PlanArrayValidatorsInterface = {
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
export interface PlanArrayValidatorsInterface {
  'containsValidator': undefined | ValidateWithErrorsFunctionInterface;
  'itemValidator': undefined | ValidateWithErrorsFunctionInterface;
  'prefixValidators': undefined | ValidateWithErrorsFunctionInterface[];
}
