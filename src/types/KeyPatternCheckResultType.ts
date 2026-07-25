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
import type { InferType } from './Schema.js';

const _KeyPatternCheckResultSchema = {
  'properties': {
    'matched': { 'type': 'boolean' },
    'valid': { 'type': 'boolean' }
  },
  'required': [
    'matched',
    'valid'
  ],
  'type': 'object'
} as const;

export type KeyPatternCheckResultType = InferType<typeof _KeyPatternCheckResultSchema>;
