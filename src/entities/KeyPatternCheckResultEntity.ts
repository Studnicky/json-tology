import type { InferType } from '../types/Schema.js';

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
 * const result: KeyPatternCheckResultEntity.Type = { matched: true, valid: false };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link PatternPropValidatorEntryInterface}
 * @group Validation
 */
export namespace KeyPatternCheckResultEntity {
  export const Schema = {
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

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.matched === 'boolean' && typeof value.valid === 'boolean';
  }
}
