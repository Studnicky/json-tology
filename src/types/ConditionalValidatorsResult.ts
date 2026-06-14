import type {
  OptionalCheckFnType, OptionalValidateWithErrorsFnType
} from '../types/Validation.js';

/**
 * Conditional validators compiled from `if`, `then`, and `else` schema keywords.
 *
 * @remarks
 * Produced once per schema node during compilation. `ifCheck` is the fast-path
 * predicate for the condition; `thenValidator` and `elseValidator` are the full
 * validators for each branch. All three fields are `undefined` when the
 * corresponding keyword is absent.
 *
 * @example
 * ```ts
 * const cond: ConditionalValidatorsResultType = {
 *   ifCheck: checkKind,
 *   thenValidator: validateCircle,
 *   elseValidator: undefined,
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link CompositionValidatorsResultType}
 * @group Validation
 */
export type ConditionalValidatorsResultType = {
  readonly 'elseValidator': OptionalValidateWithErrorsFnType;
  readonly 'ifCheck': OptionalCheckFnType;
  readonly 'thenValidator': OptionalValidateWithErrorsFnType;
};
