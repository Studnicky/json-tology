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

/** JSON Schema for the schema-expressible fields of `MaterializerRunOptionsType`. */
export const MATERIALIZER_RUN_OPTIONS_SCHEMA = {
  'properties': {
    'baseIri': { 'type': 'string' },
    'synthesizeDefaults': { 'type': 'boolean' }
  },
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `MaterializerOptionsType`. */
export const MATERIALIZER_OPTIONS_SCHEMA = {
  'properties': { 'passAdditionalProperties': { 'type': 'boolean' } },
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `MutablePropertySchemaType`. */
export const MUTABLE_PROPERTY_SCHEMA_SCHEMA = {
  'properties': {
    'maxItems': { 'type': 'number' },
    'minItems': { 'type': 'number' }
  },
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `NormalizedToQuadsOptionsType`. */
export const NORMALIZED_TO_QUADS_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `OwlCodegenOptionsType`. */
export const OWL_CODEGEN_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for `RegistryFileEntryType`. */
export const REGISTRY_FILE_ENTRY_SCHEMA = {
  'properties': {
    'iri': { 'type': 'string' },
    'name': { 'type': 'string' },
    'path': { 'type': 'string' },
    'source': { 'type': 'string' }
  },
  'required': [
    'iri',
    'name',
    'path',
    'source'
  ],
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `OwlRegistryDirOptionsType`. */
export const OWL_REGISTRY_DIR_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `GenerateFromTboxOptionsType`. */
export const GENERATE_FROM_TBOX_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `GenerateRegistryDirectoryOptionsType`. */
export const GENERATE_REGISTRY_DIRECTORY_OPTIONS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for `GenerateRegistryDirectoryEntityFileType`. */
export const GENERATE_REGISTRY_DIRECTORY_ENTITY_FILE_SCHEMA = {
  'properties': {
    'iri': { 'type': 'string' },
    'name': { 'type': 'string' },
    'path': { 'type': 'string' },
    'source': { 'type': 'string' }
  },
  'required': [
    'iri',
    'name',
    'path',
    'source'
  ],
  'type': 'object'
} as const;

/** JSON Schema for `WrittenEntityFileType`. */
export const WRITTEN_ENTITY_FILE_SCHEMA = {
  'properties': {
    'iri': { 'type': 'string' },
    'name': { 'type': 'string' },
    'path': { 'type': 'string' }
  },
  'required': [
    'iri',
    'name',
    'path'
  ],
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `OwlImporterOptionsType`. */
export const OWL_IMPORTER_OPTIONS_SCHEMA = {
  'properties': {
    'baseIri': { 'type': 'string' },
    'prefixes': {
      'additionalProperties': { 'type': 'string' },
      'type': 'object'
    }
  },
  'required': ['baseIri'],
  'type': 'object'
} as const;

/** JSON Schema for `ParsedLiteralType`. */
export const PARSED_LITERAL_SCHEMA = {
  'properties': {
    'datatype': { 'type': 'string' },
    'language': { 'type': 'string' },
    'value': { 'type': 'string' }
  },
  'required': [
    'datatype',
    'language',
    'value'
  ],
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `PassResultType`. */
export const PASS_RESULT_SCHEMA = {
  'properties': { 'success': { 'const': true } },
  'required': ['success'],
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `PlanArrayValidatorsType`. */
export const PLAN_ARRAY_VALIDATORS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `PlanCompileWithSemanticsType`. */
export const PLAN_COMPILE_WITH_SEMANTICS_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `PlanPreludeType`. */
export const PLAN_PRELUDE_SCHEMA = {
  'additionalProperties': false,
  'properties': {},
  'type': 'object'
} as const;

/** JSON Schema for the schema-expressible fields of `ProjectAboxArgumentListType`. */
export const PROJECT_ABOX_ARGUMENT_LIST_SCHEMA = {
  'properties': { 'baseIri': { 'type': 'string' } },
  'required': ['baseIri'],
  'type': 'object'
} as const;
