import type { CheckFnType } from '../types/Validation.js';

/**
 * A pattern-property entry pairing a compiled check with its compiled regex.
 *
 * @remarks
 * Produced during compilation of `patternProperties` schema keywords. The
 * `regex` is compiled once from the pattern string and reused across all
 * validation calls. The `check` is the fast-path predicate for values whose
 * key matches the pattern.
 *
 * @example
 * ```ts
 * const entry: PatternPropCheckEntryType = {
 *   regex: /^x-/,
 *   check: isString,
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PatternPropChecksResultType}
 * @group Validation
 */
export type PatternPropCheckEntryType = {
  readonly 'check': CheckFnType;
  readonly 'regex': RegExp;
};
