/**
 * JSON Schema for a single schema load error descriptor.
 *
 * @remarks
 * Describes a failure encountered while loading a schema file. Carries the
 * source `file` path, a human-readable `message`, and a `reason` enum that
 * classifies the failure type (e.g. `'missing-id'`, `'duplicate-anchor'`,
 * `'invalid-json'`). Used as an item type within `SCHEMA_LOAD_RESULT_SCHEMA`.
 *
 * @example
 * ```ts
 * const err: InferType<typeof SCHEMA_LOAD_ERROR_SCHEMA> = {
 *   file: 'schemas/User.json',
 *   message: 'Schema is missing $id',
 *   reason: 'missing-id'
 * };
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see SCHEMA_LOAD_RESULT_SCHEMA
 * @defaultValue `{ $id: 'https://json-tology.dev/SchemaLoadError', type: 'object', ... }`
 * @group Constants
 */
export const SCHEMA_LOAD_ERROR_SCHEMA = {
  '$id': 'https://json-tology.dev/SchemaLoadError',
  'properties': {
    'file': { 'type': 'string' },
    'message': { 'type': 'string' },
    'reason': {
      'enum': [
        'duplicate-anchor',
        'duplicate-id',
        'fetch-failed',
        'invalid-json',
        'invalid-schema',
        'missing-id',
        'not-json',
        'unknown'
      ],
      'type': 'string'
    },
    'status': { 'type': 'number' }
  },
  'required': [
    'file',
    'message',
    'reason'
  ],
  'type': 'object'
} as const;

/**
 * JSON Schema for the result of a bulk schema load operation.
 *
 * @remarks
 * Summarises the outcome of loading one or more schema files. Contains
 * integer counts of `successful`, `failed`, and `skipped` files, together
 * with an `errors` array of `SchemaLoadError` descriptors for each failure.
 * Returned by `SchemaRegistry.loadDirectory` and related bulk-load APIs.
 *
 * @example
 * ```ts
 * const result: InferType<typeof SCHEMA_LOAD_RESULT_SCHEMA> = {
 *   errors: [],
 *   failed: 0,
 *   skipped: 1,
 *   successful: 5
 * };
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see SCHEMA_LOAD_ERROR_SCHEMA
 * @defaultValue `{ $id: 'https://json-tology.dev/SchemaLoadResult', type: 'object', ... }`
 * @group Constants
 */
export const SCHEMA_LOAD_RESULT_SCHEMA = {
  '$defs': { 'SchemaLoadError': SCHEMA_LOAD_ERROR_SCHEMA },
  '$id': 'https://json-tology.dev/SchemaLoadResult',
  'properties': {
    'errors': {
      'items': { '$ref': '#/$defs/SchemaLoadError' },
      'type': 'array'
    },
    'failed': { 'type': 'number' },
    'skipped': { 'type': 'number' },
    'successful': { 'type': 'number' }
  },
  'required': [
    'errors',
    'failed',
    'skipped',
    'successful'
  ],
  'type': 'object'
} as const;

/**
 * JSON Schema for a single validation error produced by the graph engine.
 *
 * @remarks
 * Describes one constraint violation found during validation or coercion.
 * Each error carries the `keyword` that triggered it (e.g. `'type'`, `'required'`),
 * a human-readable `message`, a `params` object with keyword-specific context,
 * and a JSON Pointer `path` to the failing value in the input document.
 *
 * @example
 * ```ts
 * const err: InferType<typeof VALIDATION_ERROR_SCHEMA> = {
 *   keyword: 'required',
 *   message: "must have required property 'id'",
 *   params: { missingProperty: 'id' },
 *   path: ''
 * };
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see SCHEMA_LOAD_ERROR_SCHEMA
 * @defaultValue `{ $id: 'https://json-tology.dev/ValidationError', type: 'object', ... }`
 * @group Constants
 */
export const VALIDATION_ERROR_SCHEMA = {
  '$id': 'https://json-tology.dev/ValidationError',
  'properties': {
    'keyword': {
      'description': 'Schema keyword that triggered the error',
      'type': 'string'
    },
    'message': {
      'description': 'Human-readable error message',
      'type': 'string'
    },
    'params': {
      'description': 'Keyword-specific parameters',
      'type': 'object'
    },
    'path': {
      'description': 'JSON Pointer path to the failing value',
      'type': 'string'
    }
  },
  'required': [
    'keyword',
    'message',
    'params',
    'path'
  ],
  'type': 'object'
} as const;
