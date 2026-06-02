import type { ValidationErrorType } from '../types/Validation.js';

/**
 * The result value returned by {@link CompiledValidatorInterface.validate}.
 *
 * @remarks
 * Carries the canonical validation outcome: a validity flag, the (possibly
 * coerced or defaulted) value after processing, and any accumulated errors.
 * When `valid` is false, `errors` contains at least one entry.
 *
 * @example
 * ```ts
 * const result = validator.validate(input);
 * if (!result.valid) console.error(result.errors);
 * ```
 *
 * @category Compiler
 * @since 0.1.0
 * @see {@link CompiledValidatorInterface}
 * @group Validation
 */
export interface CompiledValidationResultInterface {
  'errors': ValidationErrorType[];
  'valid': boolean;
  'value': unknown;
}

/**
 * A compiled validator produced by {@link SchemaCompiler}.
 *
 * @remarks
 * Provides two entry points: `check` for a fast boolean path that short-circuits
 * on the first error, and `validate` for the full result with coercion, defaults,
 * and error collection controlled by `CompiledValidateOptionsInterface`.
 * The `compiled` flag distinguishes real compiled validators from engine fallbacks.
 *
 * @example
 * ```ts
 * if (validator.check(data)) {
 *   const result = validator.validate(data, { applyDefaults: true });
 * }
 * ```
 *
 * @category Compiler
 * @since 0.1.0
 * @see {@link CompiledValidationResultInterface}
 * @group Validation
 */
export interface CompiledValidatorInterface {
  'check': (data: unknown) => boolean;
  /** True if this is a real compiled validator (not engine fallback) */
  'compiled': boolean;
  'validate': (data: unknown, options?: CompiledValidateOptionsInterface) => CompiledValidationResultInterface;
}

/**
 * Options controlling runtime behaviour of {@link CompiledValidatorInterface.validate}.
 *
 * @remarks
 * All flags default to false. Set `applyDefaults` to fill in schema-declared
 * default values, `castTypes` to coerce compatible primitives, `collectErrors`
 * to accumulate all errors rather than stopping at the first, and
 * `removeAdditionalProperties` / `enforceSchemaProperties` for structural
 * strictness beyond what the schema alone mandates.
 *
 * @example
 * ```ts
 * validator.validate(data, { applyDefaults: true, collectErrors: true });
 * ```
 *
 * @category Compiler
 * @since 0.1.0
 * @see {@link CompiledValidatorInterface}
 * @group Validation
 */
export interface CompiledValidateOptionsInterface {
  'applyDefaults'?: boolean;
  'castTypes'?: boolean;
  'collectErrors'?: boolean;
  'enforceSchemaProperties'?: boolean;
  'removeAdditionalProperties'?: boolean;
}
