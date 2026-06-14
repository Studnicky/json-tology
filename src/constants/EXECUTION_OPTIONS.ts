/**
 * EMPTY_ERROR_LIST — immutable empty string array sentinel for initialising error accumulator fields.
 *
 * @remarks
 * Shared sentinel value used wherever a zero-error default is required to avoid
 * allocating a new array on every call.
 *
 * @example
 * ```ts
 * const errors = EMPTY_ERROR_LIST; // readonly string[] — zero allocation
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link CAST_OPTIONS}
 * @group ExecutionOptions
 * @defaultValue `[]`
 */
export const EMPTY_ERROR_LIST: readonly string[] = Object.freeze<string[]>([]);

/**
 * CAST_OPTIONS — default execution options for cast operations.
 *
 * @remarks
 * Enables `applyDefaults` and `castTypes`; errors are thrown rather than collected.
 * Pass as the `options` argument to `GraphEngine.execute` for cast-style runs.
 *
 * @example
 * ```ts
 * engine.execute(graph, data, CAST_OPTIONS);
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
 * Pass as the `options` argument to `GraphEngine.execute` for strict clean-style runs.
 *
 * @example
 * ```ts
 * engine.execute(graph, data, CLEAN_OPTIONS);
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
 * engine.execute(graph, data, CONVERT_OPTIONS);
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
 * When passed as `options`, the engine collects every validation error encountered
 * rather than aborting at the first failure. The result carries a `ValidationErrors`
 * collection with all accumulated errors.
 *
 * @example
 * ```ts
 * const result = engine.execute(graph, data, COLLECT_ERRORS_OPTIONS);
 * if (!result.valid) console.error(result.errors.items);
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link CAST_OPTIONS}
 * @group ExecutionOptions
 * @defaultValue `{ collectErrors: true }`
 */
export const COLLECT_ERRORS_OPTIONS = Object.freeze({ 'collectErrors': true });

/**
 * EMPTY_EVALUATED_ITEMS — shared empty Set sentinel for evaluated array item indices.
 *
 * @remarks
 * Module-level singleton used in `GraphEngine` as a zero-allocation default for
 * boundary results. Never mutated — callers must not modify this set.
 *
 * @category Constants
 * @since 0.21.0
 * @group ExecutionOptions
 */
export const EMPTY_EVALUATED_ITEMS: Set<number> = new Set<number>();

/**
 * EMPTY_EVALUATED_PROPERTIES — shared empty Set sentinel for evaluated property names.
 *
 * @remarks
 * Module-level singleton used in `GraphEngine` as a zero-allocation default for
 * boundary results. Never mutated — callers must not modify this set.
 *
 * @category Constants
 * @since 0.21.0
 * @group ExecutionOptions
 */
export const EMPTY_EVALUATED_PROPERTIES: Set<string> = new Set<string>();
