import type {
  CheckFnType, ValidateWithErrorsFnType
} from '../types/Validation.js';

/**
 * Composition validators compiled from `allOf`, `anyOf`, and `oneOf` schema keywords.
 *
 * @remarks
 * Produced once per schema node during compilation. `allOfValidators` collects
 * full validators for error reporting; `anyOfChecks` and `oneOfChecks` use the
 * fast-path predicate form. All three fields are `undefined` when the
 * corresponding keyword is absent from the schema.
 *
 * @example
 * ```ts
 * const comp: CompositionValidatorsResultType = {
 *   allOfValidators: [validateA, validateB],
 *   anyOfChecks: [checkX, checkY],
 *   oneOfChecks: undefined,
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
  readonly 'oneOfChecks': CheckFnType[] | undefined;
};
