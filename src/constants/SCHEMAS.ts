/**
 * JSON Schema for the `set` changeset operation.
 *
 * @remarks
 * Defines the shape of a set operation in a diff or changeset. A set operation
 * carries an `op` discriminator fixed to `'set'`, a JSON Pointer `path`
 * identifying the target location, and a `value` holding the new content.
 * Used as a component of `DiffOpSchema`.
 *
 * @example
 * ```ts
 * const op: InferType<typeof SetOpSchema> = { op: 'set', path: '/name', value: 'Alice' };
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see DiffOpSchema
 * @defaultValue `{ $id: 'https://json-tology.dev/SetOp', type: 'object', ... }`
 * @group Constants
 */
export const SetOpSchema = {
  '$id': 'https://json-tology.dev/SetOp',
  'properties': {
    'op': { 'const': 'set' },
    'path': { 'type': 'string' },
    'value': {}
  },
  'required': [
    'op',
    'path',
    'value'
  ],
  'type': 'object'
} as const;

/**
 * JSON Schema for the `delete` changeset operation.
 *
 * @remarks
 * Defines the shape of a delete operation in a diff or changeset. A delete
 * operation carries an `op` discriminator fixed to `'delete'` and a JSON Pointer
 * `path` identifying the property to remove. Used as a component of `DiffOpSchema`.
 *
 * @example
 * ```ts
 * const op: InferType<typeof DelOpSchema> = { op: 'delete', path: '/name' };
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see DiffOpSchema
 * @defaultValue `{ $id: 'https://json-tology.dev/DelOp', type: 'object', ... }`
 * @group Constants
 */
export const DelOpSchema = {
  '$id': 'https://json-tology.dev/DelOp',
  'properties': {
    'op': { 'const': 'delete' },
    'path': { 'type': 'string' }
  },
  'required': [
    'op',
    'path'
  ],
  'type': 'object'
} as const;

/**
 * JSON Schema for a discriminated union of all changeset operation types.
 *
 * @remarks
 * Combines `SetOpSchema` and `DelOpSchema` into a `oneOf` discriminated union.
 * Consumers validate individual changeset entries against this schema to ensure
 * each operation has a recognised `op` value and the correct accompanying fields.
 *
 * @example
 * ```ts
 * const result = engine.validate(DiffOpSchema, { op: 'set', path: '/x', value: 1 });
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see SetOpSchema
 * @see DelOpSchema
 * @defaultValue `{ $id: 'https://json-tology.dev/DiffOp', oneOf: [SetOp, DelOp] }`
 * @group Constants
 */
export const DiffOpSchema = {
  '$defs': {
    'DelOp': DelOpSchema,
    'SetOp': SetOpSchema
  },
  '$id': 'https://json-tology.dev/DiffOp',
  'oneOf': [
    { '$ref': '#/$defs/SetOp' },
    { '$ref': '#/$defs/DelOp' }
  ]
} as const;

/**
 * JSON Schema for a single schema load error descriptor.
 *
 * @remarks
 * Describes a failure encountered while loading a schema file. Carries the
 * source `file` path, a human-readable `message`, and a `reason` enum that
 * classifies the failure type (e.g. `'missing-id'`, `'duplicate-anchor'`,
 * `'invalid-json'`). Used as an item type within `SchemaLoadResultSchema`.
 *
 * @example
 * ```ts
 * const err: InferType<typeof SchemaLoadErrorSchema> = {
 *   file: 'schemas/User.json',
 *   message: 'Schema is missing $id',
 *   reason: 'missing-id'
 * };
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see SchemaLoadResultSchema
 * @defaultValue `{ $id: 'https://json-tology.dev/SchemaLoadError', type: 'object', ... }`
 * @group Constants
 */
export const SchemaLoadErrorSchema = {
  '$id': 'https://json-tology.dev/SchemaLoadError',
  'properties': {
    'file': { 'type': 'string' },
    'message': { 'type': 'string' },
    'reason': {
      'enum': [
        'duplicate-anchor',
        'duplicate-id',
        'invalid-json',
        'invalid-schema',
        'missing-id',
        'not-json',
        'unknown'
      ],
      'type': 'string'
    }
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
 * const result: InferType<typeof SchemaLoadResultSchema> = {
 *   errors: [],
 *   failed: 0,
 *   skipped: 1,
 *   successful: 5
 * };
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see SchemaLoadErrorSchema
 * @defaultValue `{ $id: 'https://json-tology.dev/SchemaLoadResult', type: 'object', ... }`
 * @group Constants
 */
export const SchemaLoadResultSchema = {
  '$defs': { 'SchemaLoadError': SchemaLoadErrorSchema },
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
 * const err: InferType<typeof ValidationErrorSchema> = {
 *   keyword: 'required',
 *   message: "must have required property 'id'",
 *   params: { missingProperty: 'id' },
 *   path: ''
 * };
 * ```
 *
 * @category Schemas
 * @since 0.1.0
 * @see SchemaLoadErrorSchema
 * @defaultValue `{ $id: 'https://json-tology.dev/ValidationError', type: 'object', ... }`
 * @group Constants
 */
export const ValidationErrorSchema = {
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
