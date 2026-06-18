/**
 * A format-validator predicate applied to a single value.
 *
 * @remarks
 * A boolean function called by FormatRegistry to test whether a value conforms
 * to a registered format constraint. Receives `unknown` so callers need not
 * narrow before passing. Returns `true` when the value satisfies the format and
 * `false` otherwise.
 *
 * @example
 * ```ts
 * const isEmail: FormatPredicateType = (value: unknown) =>
 *   typeof value === 'string' && value.includes('@');
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @group Validation
 */
export type FormatPredicateType = (value: unknown) => boolean;
