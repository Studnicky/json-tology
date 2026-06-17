/**
 * CAST_OPTIONS — default execution options for cast operations.
 *
 * @remarks
 * Enables `applyDefaults` and `castTypes`; errors are thrown rather than collected.
 * Pass as the `options` argument to a compiled validator's `validate` for cast-style runs.
 *
 * @example
 * ```ts
 * compiled.validate(data, CAST_OPTIONS);
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link CLEAN_OPTIONS}
 * @group ExecutionOptions
 * @defaultValue `{ applyDefaults: true, castTypes: true, collectErrors: false }`
 */
export const CAST_OPTIONS = Object.freeze({
  'applyDefaults': true,
  'castTypes': true,
  'collectErrors': false
});

/**
 * CLEAN_OPTIONS — default execution options for clean operations.
 *
 * @remarks
 * Enforces schema properties and throws on first error rather than collecting them.
 * Pass as the `options` argument to a compiled validator's `validate` for strict clean-style runs.
 *
 * @example
 * ```ts
 * compiled.validate(data, CLEAN_OPTIONS);
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link CAST_OPTIONS}
 * @group ExecutionOptions
 * @defaultValue `{ collectErrors: false, enforceSchemaProperties: true }`
 */
export const CLEAN_OPTIONS = Object.freeze({
  'collectErrors': false,
  'enforceSchemaProperties': true
});

/**
 * CONVERT_OPTIONS — default execution options for convert operations.
 *
 * @remarks
 * Enables `castTypes`; errors are thrown rather than collected. Suitable for
 * format-conversion passes where type coercion is expected but defaults are not applied.
 *
 * @example
 * ```ts
 * compiled.validate(data, CONVERT_OPTIONS);
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link CAST_OPTIONS}
 * @group ExecutionOptions
 * @defaultValue `{ castTypes: true, collectErrors: false }`
 */
export const CONVERT_OPTIONS = Object.freeze({
  'castTypes': true,
  'collectErrors': false
});

/**
 * COLLECT_ERRORS_OPTIONS — default execution options that accumulate all errors instead of throwing on first failure.
 *
 * @remarks
 * When passed as `options`, the compiled validator collects every validation error
 * encountered rather than aborting at the first failure. The result carries a
 * `ValidationErrors` collection with all accumulated errors.
 *
 * @example
 * ```ts
 * const result = compiled.validate(data, COLLECT_ERRORS_OPTIONS);
 * if (!result.valid) console.error(result.errors);
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link CAST_OPTIONS}
 * @group ExecutionOptions
 * @defaultValue `{ collectErrors: true }`
 */
export const COLLECT_ERRORS_OPTIONS = Object.freeze({ 'collectErrors': true });

