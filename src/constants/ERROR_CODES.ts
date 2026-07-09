import type {
  CoercionErrorCodeType,
  GraphErrorCodeType,
  InstantiationErrorCodeType,
  MaterializationErrorCodeType,
  OwlImportErrorCodeType,
  SchemaErrorCodeType,
  SchemaLoadErrorCodeType,
  TransformErrorCodeType
} from '../types/ErrorCodes.js';

/**
 * Error codes for coercion failures during value casting.
 *
 * @remarks
 * Thrown by `CoercionError` when a value cannot be cast to the expected type.
 * The `COERCION_FAILED` code is emitted alongside a `ValidationErrors`
 * collection that describes each field-level failure.
 *
 * @example
 * ```ts
 * throw new CoercionError(COERCION_ERROR_CODE.COERCION_FAILED, errors);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link CoercionErrorCodeType}
 * @defaultValue `{ COERCION_FAILED: 'COERCION_FAILED' }`
 * @group Constants
 */
export const COERCION_ERROR_CODE = { 'COERCION_FAILED': 'COERCION_FAILED' } as const satisfies Record<string, CoercionErrorCodeType>;

/**
 * Error codes for schema registration and structural validation failures.
 *
 * @remarks
 * Thrown by `SchemaError` when a schema cannot be registered or fails structural
 * validation. Codes cover missing `$id`, duplicate anchors, unsupported dialects,
 * missing validators, invalid inputs, and computed-property contract violations.
 *
 * @example
 * ```ts
 * throw new SchemaError(SCHEMA_ERROR_CODE.MISSING_ID, 'Schema must declare $id');
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link SchemaErrorCodeType}
 * @defaultValue `{ COMPUTED_FN_MISSING, COMPUTED_INPUT_FORBIDDEN, DIALECT_UNSUPPORTED, ... }`
 * @group Constants
 */
export const SCHEMA_ERROR_CODE = {
  'COMPUTED_FN_MISSING': 'COMPUTED_FN_MISSING',
  'COMPUTED_INPUT_FORBIDDEN': 'COMPUTED_INPUT_FORBIDDEN',
  'DEFAULT_CREATOR_MISSING': 'SCHEMA_DEFAULT_CREATOR_MISSING',
  'DIALECT_UNSUPPORTED': 'SCHEMA_DIALECT_UNSUPPORTED',
  'DUPLICATE_ANCHOR': 'SCHEMA_DUPLICATE_ANCHOR',
  'DUPLICATE_ID': 'SCHEMA_DUPLICATE_ID',
  'DUPLICATE_SHAPE': 'SCHEMA_DUPLICATE_SHAPE',
  'IDENTITY_CONTRADICTION': 'SCHEMA_IDENTITY_CONTRADICTION',
  'INVALID_INPUT': 'SCHEMA_INVALID_INPUT',
  'MISSING_ID': 'SCHEMA_MISSING_ID',
  'NOT_REGISTERED': 'SCHEMA_NOT_REGISTERED',
  'PROPERTY_CHARACTERISTIC_CONFLICT': 'PROPERTY_CHARACTERISTIC_CONFLICT',
  'STRUCTURE_INVALID': 'SCHEMA_STRUCTURE_INVALID',
  'VALIDATOR_MISSING': 'SCHEMA_VALIDATOR_MISSING'
} as const satisfies Record<string, SchemaErrorCodeType>;

/**
 * Error codes for graph traversal and pointer resolution failures.
 *
 * @remarks
 * Thrown by `GraphError` when the canonical schema graph encounters a structural
 * problem: unresolved `$ref`, missing anchor, invalid JSON Pointer, unsupported
 * dialect or vocabulary, exceeded recursion depth, or stale/invalid artifacts.
 *
 * @example
 * ```ts
 * throw new GraphError(GRAPH_ERROR_CODE.REF_UNRESOLVED, ref);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link GraphErrorCodeType}
 * @defaultValue `{ ANCHOR_NOT_FOUND, ARTIFACT_INVALID, ARTIFACT_STALE, ... }`
 * @group Constants
 */
export const GRAPH_ERROR_CODE = {
  'ANCHOR_NOT_FOUND': 'ANCHOR_NOT_FOUND',
  'ARTIFACT_INVALID': 'ARTIFACT_INVALID',
  'ARTIFACT_STALE': 'ARTIFACT_STALE',
  'CURSOR_CARDINALITY': 'CURSOR_CARDINALITY',
  'DIALECT_UNSUPPORTED': 'DIALECT_UNSUPPORTED',
  'INVALID_LANGUAGE_TAG': 'INVALID_LANGUAGE_TAG',
  'INVALID_PREDICATE_IRI': 'INVALID_PREDICATE_IRI',
  'POINTER_INVALID': 'POINTER_INVALID',
  'POINTER_NOT_FOUND': 'POINTER_NOT_FOUND',
  'POINTER_NOT_SCHEMA': 'POINTER_NOT_SCHEMA',
  'RECURSION_LIMIT': 'RECURSION_LIMIT',
  'REF_NOT_FOUND': 'REF_NOT_FOUND',
  'REF_UNRESOLVED': 'REF_UNRESOLVED',
  'VOCABULARY_UNSUPPORTED': 'VOCABULARY_UNSUPPORTED'
} as const satisfies Record<string, GraphErrorCodeType>;

/**
 * Error codes for schema instantiation failures.
 *
 * @remarks
 * Thrown by instantiation logic when a value cannot be constructed from schema
 * defaults. `EXTRA_FORBIDDEN` is emitted when an additional property is present
 * but the schema disallows extras; `INSTANTIATION_FAILED` covers all other failures.
 *
 * @example
 * ```ts
 * throw new InstantiationError(INSTANTIATION_ERROR_CODE.EXTRA_FORBIDDEN, path);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link InstantiationErrorCodeType}
 * @defaultValue `{ EXTRA_FORBIDDEN: 'EXTRA_FORBIDDEN', INSTANTIATION_FAILED: 'INSTANTIATION_FAILED' }`
 * @group Constants
 */
export const INSTANTIATION_ERROR_CODE = {
  'EXTRA_FORBIDDEN': 'EXTRA_FORBIDDEN',
  'INSTANTIATION_FAILED': 'INSTANTIATION_FAILED'
} as const satisfies Record<string, InstantiationErrorCodeType>;

/**
 * Error codes for materialization and ABox projection failures.
 *
 * @remarks
 * Thrown by `MaterializationError` when the materializer cannot project graph
 * execution output into JavaScript values or ABox nodes. `CYCLIC_DATA` is emitted
 * when a cycle is detected in the materialized object graph; `MATERIALIZATION_FAILED`
 * covers other structural failures.
 *
 * @example
 * ```ts
 * throw new MaterializationError(MATERIALIZATION_ERROR_CODE.CYCLIC_DATA, path);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link MaterializationErrorCodeType}
 * @defaultValue `{ CYCLIC_DATA: 'CYCLIC_DATA', MATERIALIZATION_FAILED: 'MATERIALIZATION_FAILED' }`
 * @group Constants
 */
export const MATERIALIZATION_ERROR_CODE = {
  'CYCLIC_DATA': 'CYCLIC_DATA',
  'INVALID_IRI_VALUE': 'INVALID_IRI_VALUE',
  'MATERIALIZATION_FAILED': 'MATERIALIZATION_FAILED',
  'MISSING_GRAPH_IRI': 'MISSING_GRAPH_IRI',
  'NON_FINITE_NUMBER': 'NON_FINITE_NUMBER'
} as const satisfies Record<string, MaterializationErrorCodeType>;

/**
 * Error codes for OWL import failures.
 *
 * @remarks
 * Thrown by `OwlImportError`. `PARSE_FAILED` indicates malformed JSON-LD input.
 * `PEER_DEPENDENCY_MISSING` indicates that processing non-quad JSON-LD input
 * requires the optional `jsonld` peer dependency, which is not installed.
 *
 * @example
 * ```ts
 * throw new OwlImportError(message, { code: OWL_IMPORT_ERROR_CODE.PARSE_FAILED, axiomIri, subjectIri });
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link OwlImportErrorCodeType}
 * @defaultValue `{ PARSE_FAILED: 'OWL_IMPORT_PARSE_FAILED', PEER_DEPENDENCY_MISSING: 'OWL_IMPORT_PEER_DEPENDENCY_MISSING' }`
 * @group Constants
 */
export const OWL_IMPORT_ERROR_CODE = {
  'PARSE_FAILED': 'OWL_IMPORT_PARSE_FAILED',
  'PEER_DEPENDENCY_MISSING': 'OWL_IMPORT_PEER_DEPENDENCY_MISSING'
} as const satisfies Record<string, OwlImportErrorCodeType>;

/**
 * Error codes for codec transform encode and decode failures.
 *
 * @remarks
 * Thrown by `TransformError` when a registered codec cannot encode or decode a
 * value. `TRANSFORM_DECODE_FAILED` is emitted on decode errors;
 * `TRANSFORM_ENCODE_FAILED` is emitted on encode errors.
 *
 * @example
 * ```ts
 * throw new TransformError(TRANSFORM_ERROR_CODE.TRANSFORM_DECODE_FAILED, detail);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link TransformErrorCodeType}
 * @defaultValue `{ TRANSFORM_DECODE_FAILED: 'TRANSFORM_DECODE_FAILED', TRANSFORM_ENCODE_FAILED: 'TRANSFORM_ENCODE_FAILED' }`
 * @group Constants
 */
export const TRANSFORM_ERROR_CODE = {
  'TRANSFORM_DECODE_FAILED': 'TRANSFORM_DECODE_FAILED',
  'TRANSFORM_ENCODE_FAILED': 'TRANSFORM_ENCODE_FAILED'
} as const satisfies Record<string, TransformErrorCodeType>;

/**
 * Error codes for schema load failures.
 *
 * @remarks
 * Thrown by `SchemaLoadError` when the schema loader cannot fetch or parse a
 * remote schema. Covers HTTP 5xx transient failures (`fetch-failed`), schemas
 * returned without a `$id` (`missing-id`), and structurally invalid content
 * (`invalid-schema`).
 *
 * @example
 * ```ts
 * throw new SchemaLoadError(message, { code: SCHEMA_LOAD_ERROR_CODE.LOAD_FAILED, file: url, reason: 'fetch-failed', status: 503, retryable: true });
 * ```
 *
 * @category Error Codes
 * @since 0.25.0
 * @see {@link SchemaLoadErrorCodeType}
 * @defaultValue `{ LOAD_FAILED: 'SCHEMA_LOAD_FAILED' }`
 * @group Constants
 */
export const SCHEMA_LOAD_ERROR_CODE = { 'LOAD_FAILED': 'SCHEMA_LOAD_FAILED' } as const satisfies Record<string, SchemaLoadErrorCodeType>;

/**
 * Sentinel code used when serializing a non-BaseError instance into the
 * structured error JSON format. The underlying error has no machine-readable code.
 *
 * @category Error Codes
 * @since 0.1.0
 * @group Constants
 */
export const UNKNOWN_ERROR_CODE = 'UNKNOWN' as const;
