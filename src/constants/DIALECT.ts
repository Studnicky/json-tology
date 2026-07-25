import type { DefaultGraphEngineOptionsType } from '../types/DefaultGraphEngineOptionsType.js';

/**
 * Short name of the supported JSON Schema draft version.
 *
 * @remarks
 * Used to identify the draft in error messages and dialect detection logic.
 *
 * @example
 * ```ts
 * console.log(`Supported draft: ${DRAFT_NAME}`);
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see DEFAULT_DIALECT_URI
 * @defaultValue `'2020-12'`
 * @group Constants
 */
export const DRAFT_NAME = '2020-12';

/**
 * Base URI prefix for the JSON Schema draft-2020-12 dialect.
 *
 * @remarks
 * Used to detect whether a `$schema` value belongs to the 2020-12 dialect by
 * checking that it starts with this prefix.
 *
 * @example
 * ```ts
 * if (schema.$schema?.startsWith(CURRENT_DIALECT_PREFIX)) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see DEFAULT_DIALECT_URI
 * @defaultValue `'https://json-schema.org/draft/2020-12/'`
 * @group Constants
 */
export const CURRENT_DIALECT_PREFIX = 'https://json-schema.org/draft/2020-12/';

/**
 * Canonical `$schema` URI for the JSON Schema draft-2020-12 meta-schema.
 *
 * @remarks
 * The default dialect URI applied when a schema omits the `$schema` keyword.
 * Also used as the authoritative identifier for the supported dialect.
 *
 * @example
 * ```ts
 * const schemaUri = schema.$schema ?? DEFAULT_DIALECT_URI;
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see {@link https://json-schema.org/draft/2020-12/schema JSON Schema draft-2020-12 meta-schema}
 * @defaultValue `'https://json-schema.org/draft/2020-12/schema'`
 * @group Constants
 */
export const DEFAULT_DIALECT_URI = 'https://json-schema.org/draft/2020-12/schema';

/**
 * URI for the JSON Schema draft-2020-12 `core` vocabulary.
 *
 * @remarks
 * Identifies the core vocabulary in `$vocabulary` maps. The core vocabulary
 * defines `$id`, `$ref`, `$anchor`, `$schema`, and related structural keywords.
 *
 * @example
 * ```ts
 * if (vocab[VOCABULARY_CORE] === true) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see SUPPORTED_VOCABULARIES
 * @defaultValue `'https://json-schema.org/draft/2020-12/vocab/core'`
 * @group Constants
 */
export const VOCABULARY_CORE = 'https://json-schema.org/draft/2020-12/vocab/core';

/**
 * URI for the JSON Schema draft-2020-12 `applicator` vocabulary.
 *
 * @remarks
 * Identifies the applicator vocabulary in `$vocabulary` maps. The applicator
 * vocabulary defines `allOf`, `anyOf`, `oneOf`, `not`, `if`/`then`/`else`, etc.
 *
 * @example
 * ```ts
 * if (SUPPORTED_VOCABULARIES.has(VOCABULARY_APPLICATOR)) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see SUPPORTED_VOCABULARIES
 * @defaultValue `'https://json-schema.org/draft/2020-12/vocab/applicator'`
 * @group Constants
 */
export const VOCABULARY_APPLICATOR = 'https://json-schema.org/draft/2020-12/vocab/applicator';

/**
 * URI for the JSON Schema draft-2020-12 `unevaluated` vocabulary.
 *
 * @remarks
 * Identifies the unevaluated vocabulary in `$vocabulary` maps. Defines
 * `unevaluatedProperties` and `unevaluatedItems` keywords.
 *
 * @example
 * ```ts
 * if (SUPPORTED_VOCABULARIES.has(VOCABULARY_UNEVALUATED)) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see SUPPORTED_VOCABULARIES
 * @defaultValue `'https://json-schema.org/draft/2020-12/vocab/unevaluated'`
 * @group Constants
 */
export const VOCABULARY_UNEVALUATED = 'https://json-schema.org/draft/2020-12/vocab/unevaluated';

/**
 * URI for the JSON Schema draft-2020-12 `validation` vocabulary.
 *
 * @remarks
 * Identifies the validation vocabulary in `$vocabulary` maps. Defines type,
 * enum, const, numeric range, string length, array length, and required keywords.
 *
 * @example
 * ```ts
 * if (SUPPORTED_VOCABULARIES.has(VOCABULARY_VALIDATION)) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see SUPPORTED_VOCABULARIES
 * @defaultValue `'https://json-schema.org/draft/2020-12/vocab/validation'`
 * @group Constants
 */
export const VOCABULARY_VALIDATION = 'https://json-schema.org/draft/2020-12/vocab/validation';

/**
 * URI for the JSON Schema draft-2020-12 `meta-data` vocabulary.
 *
 * @remarks
 * Identifies the meta-data vocabulary in `$vocabulary` maps. Defines `title`,
 * `description`, `default`, `deprecated`, `readOnly`, `writeOnly`, and `examples`.
 *
 * @example
 * ```ts
 * if (SUPPORTED_VOCABULARIES.has(VOCABULARY_METADATA)) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see SUPPORTED_VOCABULARIES
 * @defaultValue `'https://json-schema.org/draft/2020-12/vocab/meta-data'`
 * @group Constants
 */
export const VOCABULARY_METADATA = 'https://json-schema.org/draft/2020-12/vocab/meta-data';

/**
 * URI for the JSON Schema draft-2020-12 `format-annotation` vocabulary.
 *
 * @remarks
 * Identifies the format-annotation vocabulary. In annotation mode, `format` is
 * collected as metadata but not used for validation. json-tology supports both
 * annotation and assertion mode vocabularies.
 *
 * @example
 * ```ts
 * if (SUPPORTED_VOCABULARIES.has(VOCABULARY_FORMAT_ANNOTATION)) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see VOCABULARY_FORMAT_ASSERTION
 * @defaultValue `'https://json-schema.org/draft/2020-12/vocab/format-annotation'`
 * @group Constants
 */
export const VOCABULARY_FORMAT_ANNOTATION = 'https://json-schema.org/draft/2020-12/vocab/format-annotation';

/**
 * URI for the JSON Schema draft-2020-12 `format-assertion` vocabulary.
 *
 * @remarks
 * Identifies the format-assertion vocabulary. In assertion mode, `format` is
 * used to validate string values against registered format validators.
 *
 * @example
 * ```ts
 * if (SUPPORTED_VOCABULARIES.has(VOCABULARY_FORMAT_ASSERTION)) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see VOCABULARY_FORMAT_ANNOTATION
 * @defaultValue `'https://json-schema.org/draft/2020-12/vocab/format-assertion'`
 * @group Constants
 */
export const VOCABULARY_FORMAT_ASSERTION = 'https://json-schema.org/draft/2020-12/vocab/format-assertion';

/**
 * URI for the JSON Schema draft-2020-12 `content` vocabulary.
 *
 * @remarks
 * Identifies the content vocabulary in `$vocabulary` maps. Defines
 * `contentEncoding`, `contentMediaType`, and `contentSchema` keywords.
 *
 * @example
 * ```ts
 * if (SUPPORTED_VOCABULARIES.has(VOCABULARY_CONTENT)) { ... }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see SUPPORTED_VOCABULARIES
 * @defaultValue `'https://json-schema.org/draft/2020-12/vocab/content'`
 * @group Constants
 */
export const VOCABULARY_CONTENT = 'https://json-schema.org/draft/2020-12/vocab/content';

/**
 * Set of all JSON Schema draft-2020-12 vocabulary URIs supported by json-tology.
 *
 * @remarks
 * Used during schema registration to verify that the `$vocabulary` map only
 * references vocabularies the engine knows how to process. An unsupported
 * vocabulary URI triggers a `VOCABULARY_UNSUPPORTED` error.
 *
 * @example
 * ```ts
 * for (const [uri, required] of Object.entries(vocab)) {
 *   if (!SUPPORTED_VOCABULARIES.has(uri) && required) {
 *     throw new GraphError(GRAPH_ERROR_CODE.VOCABULARY_UNSUPPORTED, uri);
 *   }
 * }
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see {@link https://json-schema.org/draft/2020-12/json-schema-core#section-8.1.2 JSON Schema §8.1.2}
 * @defaultValue `new Set([...])`
 * @group Constants
 */
export const SUPPORTED_VOCABULARIES = new Set([
  VOCABULARY_APPLICATOR,
  VOCABULARY_CONTENT,
  VOCABULARY_CORE,
  VOCABULARY_FORMAT_ANNOTATION,
  VOCABULARY_FORMAT_ASSERTION,
  VOCABULARY_METADATA,
  VOCABULARY_UNEVALUATED,
  VOCABULARY_VALIDATION
]);

/**
 * Default `GraphEngine` options applied when the caller omits option fields.
 *
 * @remarks
 * Provides the strictest safe defaults: additional properties are rejected,
 * type coercion and default synthesis are disabled, and all errors are collected
 * before returning. Callers opt in to relaxed behaviour by overriding individual fields.
 *
 * @example
 * ```ts
 * const engine = new GraphEngine(graph, {
 *   ...DEFAULT_OPTIONS,
 *   applyDefaults: true,
 * });
 * ```
 *
 * @category Dialect
 * @since 0.1.0
 * @see DefaultGraphEngineOptionsType
 * @defaultValue `{...}`
 * @group Constants
 */
export const DEFAULT_OPTIONS: DefaultGraphEngineOptionsType = {
  'allowAdditionalProperties': false,
  'applyDefaults': false,
  'castTypes': false,
  'collectErrors': true,
  'enforceSchemaProperties': false,
  'materializeContainers': false,
  'maxSchemaDepth': Infinity,
  'removeAdditionalProperties': false,
  'synthesizeDefaults': false
};
