import type {
  CoercionErrorCodeType,
  GraphErrorCodeType,
  InstantiationErrorCodeType,
  MaterializationErrorCodeType,
  OwlImportErrorCodeType,
  SchemaErrorCodeType,
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
 * throw new CoercionError(CoercionErrorCode.COERCION_FAILED, errors);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link CoercionErrorCodeType}
 * @defaultValue `{ COERCION_FAILED: 'COERCION_FAILED' }`
 * @group Constants
 */
export const CoercionErrorCode = { 'COERCION_FAILED': 'COERCION_FAILED' } as const satisfies Record<string, CoercionErrorCodeType>;

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
 * throw new SchemaError(SchemaErrorCode.MISSING_ID, 'Schema must declare $id');
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link SchemaErrorCodeType}
 * @defaultValue `{ COMPUTED_FN_MISSING, COMPUTED_INPUT_FORBIDDEN, DIALECT_UNSUPPORTED, ... }`
 * @group Constants
 */
export const SchemaErrorCode = {
  'COMPUTED_FN_MISSING': 'COMPUTED_FN_MISSING',
  'COMPUTED_INPUT_FORBIDDEN': 'COMPUTED_INPUT_FORBIDDEN',
  'DIALECT_UNSUPPORTED': 'SCHEMA_DIALECT_UNSUPPORTED',
  'DUPLICATE_ANCHOR': 'SCHEMA_DUPLICATE_ANCHOR',
  'DUPLICATE_ID': 'SCHEMA_DUPLICATE_ID',
  'DUPLICATE_SHAPE': 'SCHEMA_DUPLICATE_SHAPE',
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
 * throw new GraphError(GraphErrorCode.REF_UNRESOLVED, ref);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link GraphErrorCodeType}
 * @defaultValue `{ ANCHOR_NOT_FOUND, ARTIFACT_INVALID, ARTIFACT_STALE, ... }`
 * @group Constants
 */
export const GraphErrorCode = {
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
 * throw new InstantiationError(InstantiationErrorCode.EXTRA_FORBIDDEN, path);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link InstantiationErrorCodeType}
 * @defaultValue `{ EXTRA_FORBIDDEN: 'EXTRA_FORBIDDEN', INSTANTIATION_FAILED: 'INSTANTIATION_FAILED' }`
 * @group Constants
 */
export const InstantiationErrorCode = {
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
 * throw new MaterializationError(MaterializationErrorCode.CYCLIC_DATA, path);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link MaterializationErrorCodeType}
 * @defaultValue `{ CYCLIC_DATA: 'CYCLIC_DATA', MATERIALIZATION_FAILED: 'MATERIALIZATION_FAILED' }`
 * @group Constants
 */
export const MaterializationErrorCode = {
  'CYCLIC_DATA': 'CYCLIC_DATA',
  'INVALID_IRI_VALUE': 'INVALID_IRI_VALUE',
  'MATERIALIZATION_FAILED': 'MATERIALIZATION_FAILED',
  'MISSING_GRAPH_IRI': 'MISSING_GRAPH_IRI',
  'NON_FINITE_NUMBER': 'NON_FINITE_NUMBER'
} as const satisfies Record<string, MaterializationErrorCodeType>;

/**
 * Error codes for OWL import operations that are not yet implemented.
 *
 * @remarks
 * Thrown by `OwlImportError` when an OWL import path is invoked but has not
 * been implemented. Acts as a sentinel to surface unimplemented import branches
 * at runtime rather than silently no-oping.
 *
 * @example
 * ```ts
 * throw new OwlImportError(OwlImportErrorCode.NOT_IMPLEMENTED, feature);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link OwlImportErrorCodeType}
 * @defaultValue `{ NOT_IMPLEMENTED: 'OWL_IMPORT_NOT_IMPLEMENTED' }`
 * @group Constants
 */
export const OwlImportErrorCode = { 'NOT_IMPLEMENTED': 'OWL_IMPORT_NOT_IMPLEMENTED' } as const satisfies Record<string, OwlImportErrorCodeType>;

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
 * throw new TransformError(TransformErrorCode.TRANSFORM_DECODE_FAILED, detail);
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link TransformErrorCodeType}
 * @defaultValue `{ TRANSFORM_DECODE_FAILED: 'TRANSFORM_DECODE_FAILED', TRANSFORM_ENCODE_FAILED: 'TRANSFORM_ENCODE_FAILED' }`
 * @group Constants
 */
export const TransformErrorCode = {
  'TRANSFORM_DECODE_FAILED': 'TRANSFORM_DECODE_FAILED',
  'TRANSFORM_ENCODE_FAILED': 'TRANSFORM_ENCODE_FAILED'
} as const satisfies Record<string, TransformErrorCodeType>;
