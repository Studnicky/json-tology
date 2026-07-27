/**
 * A format-validator predicate applied to a single value.
 *
 * @remarks
 * A boolean function called by FormatRegistry to test whether a value conforms
 * to a registered format constraint. Receives `unknown` so callers need not
 * narrow before passing. Returns `true` when the value satisfies the format and
 * `false` otherwise.
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 *
 * @example
 * ```ts
 * const isEmail: FormatPredicateInterface = (value: unknown) =>
 *   typeof value === 'string' && value.includes('@');
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @group Validation
 */
export interface FormatPredicateInterface {
  (value: unknown): boolean;
  readonly 'formatPredicateBrand'?: unique symbol;
}
