import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../types/Validation.js';

/**
 * Composition validators compiled from `allOf`, `anyOf`, and `oneOf` schema keywords.
 *
 * @remarks
 * Produced once per schema node during compilation. `allOfValidators` collects
 * full validators for error reporting; `anyOfChecks` and `oneOfChecks` use the
 * fast-path predicate form. When the node also has `unevaluatedProperties` or
 * `unevaluatedItems`, `anyOfValidators` and `oneOfValidators` are additionally
 * compiled as full validators so that evaluated sets can be propagated through
 * each branch. All fields are `undefined` when the corresponding keyword is absent.
 *
 * @example
 * ```ts
 * const comp: CompositionValidatorsResultType = {
 *   allOfValidators: [validateA, validateB],
 *   anyOfChecks: [checkX, checkY],
 *   anyOfValidators: undefined,
 *   oneOfChecks: undefined,
 *   oneOfValidators: undefined,
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ConditionalValidatorsResultType}
 * @group Validation
 */
export type CompositionValidatorsResultType = {
  readonly 'allOfValidators': undefined | ValidateWithErrorsFnType[];
  readonly 'anyOfChecks': CheckFnType[] | undefined;
  readonly 'anyOfValidators': undefined | ValidateWithErrorsFnType[];
  readonly 'oneOfChecks': CheckFnType[] | undefined;
  readonly 'oneOfValidators': undefined | ValidateWithErrorsFnType[];
};
