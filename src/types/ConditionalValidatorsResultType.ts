import type { OptionalValidateWithErrorsFnType } from '../types/Validation.js';

/**
 * Conditional validators compiled from `if`, `then`, and `else` schema keywords.
 *
 * @remarks
 * Produced once per schema node during compilation. `ifValidator` runs in an
 * isolated check-mode sub-context to determine the branch selector; `thenValidator`
 * and `elseValidator` are the full validators for each branch. All three fields
 * are `undefined` when the corresponding keyword is absent.
 *
 * @example
 * ```ts
 * const cond: ConditionalValidatorsResultType = {
 *   ifValidator: validateKind,
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
  'elseValidator': OptionalValidateWithErrorsFnType;
  'ifValidator': OptionalValidateWithErrorsFnType;
  'thenValidator': OptionalValidateWithErrorsFnType;
};
