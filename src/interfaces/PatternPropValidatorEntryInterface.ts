import type { ValidateWithErrorsFunctionInterface } from './ValidateWithErrorsFunctionInterface.js';

/**
 * A pattern-property entry pairing a validate-with-errors function with its compiled regex.
 *
 * @remarks
 * Produced during compilation of `patternProperties` schema keywords for the
 * full validation path (with error collection). The `regex` is compiled once
 * from the pattern string; the `validator` collects structured errors for each
 * failing value whose key matches the pattern.
 *
 * @example
 * ```ts
 * const entry: PatternPropValidatorEntryInterface = {
 *   regex: /^x-/,
 *   validator: compiledValidator,
 * };
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @group Validation
 */
export interface PatternPropValidatorEntryInterface {
  'regex': RegExp;
  'validator': ValidateWithErrorsFunctionInterface;
}
