import type {
  OptionalValidateWithErrorsFnType, ValidateWithErrorsFnType
} from '../types/Validation.js';

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
export type PlanArrayValidatorsType = {
  readonly 'containsValidator': OptionalValidateWithErrorsFnType;
  readonly 'itemValidator': OptionalValidateWithErrorsFnType;
  readonly 'prefixValidators': undefined | ValidateWithErrorsFnType[];
};
