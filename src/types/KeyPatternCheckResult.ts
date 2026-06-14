/**
 * Result of checking a key against pattern-property validators — matched/valid flags.
 *
 * @remarks
 * Returned by the pattern-property key checker. `matched` indicates whether
 * at least one pattern regex matched the key; `valid` indicates whether all
 * matching validators passed. Both flags are needed to correctly implement
 * `additionalProperties` (which only fires for unmatched keys) alongside
 * pattern property validation.
 *
 * @example
 * ```ts
 * const result: KeyPatternCheckResultType = { matched: true, valid: false };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PatternPropValidatorEntryType}
 * @group Validation
 */
export type KeyPatternCheckResultType = {
  readonly 'matched': boolean;
  readonly 'valid': boolean;
};
