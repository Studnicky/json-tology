/**
 * Error code type unions — machine-readable string codes carried by every
 * json-tology error class.
 *
 * Each type is a union of the string literals that a particular error class
 * may emit. Consumers can switch on `error.code` and TypeScript will narrow
 * the union to the matching literal.
 */

/**
 * Error codes emitted by `CoercionError`.
 *
 * @remarks
 * Produced when a value cannot be coerced to the target schema type.
 * Carries a `ValidationErrors` collection describing each failed constraint.
 *
 * @example
 * ```ts
 * import type { CoercionErrorCodeType } from 'json-tology/types';
 * function isCoercionCode(code: string): code is CoercionErrorCodeType {
 *   return code === 'COERCION_FAILED';
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link SchemaErrorCodeType}
 * @group Error Codes
 */
export type CoercionErrorCodeType = 'COERCION_FAILED';

/**
 * Error codes emitted by `SchemaError`.
 *
 * @remarks
 * Produced during schema registration, structure validation, or when a
 * required schema cannot be located. Switch on `error.code` to distinguish
 * between missing `$id`, duplicate registrations, and dialect mismatches.
 *
 * @example
 * ```ts
 * import type { SchemaErrorCodeType } from 'json-tology/types';
 * function handleSchema(code: SchemaErrorCodeType): void {
 *   if (code === 'SCHEMA_MISSING_ID') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link GraphErrorCodeType}
 * @group Error Codes
 */
export type SchemaErrorCodeType
  = | 'COMPUTED_FN_MISSING'
  | 'COMPUTED_INPUT_FORBIDDEN'
  | 'PROPERTY_CHARACTERISTIC_CONFLICT'
  | 'SCHEMA_DIALECT_UNSUPPORTED'
  | 'SCHEMA_DUPLICATE_ANCHOR'
  | 'SCHEMA_DUPLICATE_ID'
  | 'SCHEMA_DUPLICATE_SHAPE'
  | 'SCHEMA_INVALID_INPUT'
  | 'SCHEMA_MISSING_ID'
  | 'SCHEMA_NOT_REGISTERED'
  | 'SCHEMA_STRUCTURE_INVALID'
  | 'SCHEMA_VALIDATOR_MISSING';

/**
 * Error codes emitted by `GraphError`.
 *
 * @remarks
 * Produced during canonical graph construction, pointer resolution, anchor
 * lookup, `$ref` resolution, and dialect or vocabulary handling. Switch on
 * `error.code` to distinguish between unresolved references, invalid pointers,
 * recursion limits, and unsupported vocabulary declarations.
 *
 * @example
 * ```ts
 * import type { GraphErrorCodeType } from 'json-tology/types';
 * function handleGraph(code: GraphErrorCodeType): void {
 *   if (code === 'REF_UNRESOLVED') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link SchemaErrorCodeType}
 * @group Error Codes
 */
export type GraphErrorCodeType
  = | 'ANCHOR_NOT_FOUND'
  | 'ARTIFACT_INVALID'
  | 'ARTIFACT_STALE'
  | 'CURSOR_CARDINALITY'
  | 'DIALECT_UNSUPPORTED'
  | 'EXEC_NOT_SUPPORTED'
  | 'INVALID_LANGUAGE_TAG'
  | 'INVALID_PREDICATE_IRI'
  | 'POINTER_INVALID'
  | 'POINTER_NOT_FOUND'
  | 'POINTER_NOT_SCHEMA'
  | 'RECURSION_LIMIT'
  | 'REF_NOT_FOUND'
  | 'REF_UNRESOLVED'
  | 'VOCABULARY_UNSUPPORTED';

/**
 * Error codes emitted by `InstantiationError`.
 *
 * @remarks
 * Produced by `JsonTology.instantiate` when the value fails validation
 * (`INSTANTIATION_FAILED`) or when extra properties are present and the schema
 * disallows them (`EXTRA_FORBIDDEN`).
 *
 * @example
 * ```ts
 * import type { InstantiationErrorCodeType } from 'json-tology/types';
 * function handleInstantiation(code: InstantiationErrorCodeType): void {
 *   if (code === 'EXTRA_FORBIDDEN') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link CoercionErrorCodeType}
 * @group Error Codes
 */
export type InstantiationErrorCodeType = 'EXTRA_FORBIDDEN' | 'INSTANTIATION_FAILED';

/**
 * Error codes emitted by `TransformError`.
 *
 * @remarks
 * Produced when a `Transform` pipeline stage fails to decode or encode a value.
 * `TRANSFORM_DECODE_FAILED` is thrown on the inbound path; `TRANSFORM_ENCODE_FAILED`
 * on the outbound path.
 *
 * @example
 * ```ts
 * import type { TransformErrorCodeType } from 'json-tology/types';
 * function handleTransform(code: TransformErrorCodeType): void {
 *   if (code === 'TRANSFORM_DECODE_FAILED') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link CoercionErrorCodeType}
 * @group Error Codes
 */
export type TransformErrorCodeType = 'TRANSFORM_DECODE_FAILED' | 'TRANSFORM_ENCODE_FAILED';

/**
 * Error codes emitted by `MaterializationError`.
 *
 * @remarks
 * Produced during ABox projection when a value cannot be lifted into the RDF
 * graph. Covers cyclic data (`CYCLIC_DATA`), values that are not valid IRIs
 * (`INVALID_IRI_VALUE`), non-finite numbers (`NON_FINITE_NUMBER`), a missing
 * graph IRI (`MISSING_GRAPH_IRI`), and general materialization failure
 * (`MATERIALIZATION_FAILED`).
 *
 * @example
 * ```ts
 * import type { MaterializationErrorCodeType } from 'json-tology/types';
 * function handleMaterialization(code: MaterializationErrorCodeType): void {
 *   if (code === 'CYCLIC_DATA') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link GraphErrorCodeType}
 * @group Error Codes
 */
export type MaterializationErrorCodeType
  = | 'CYCLIC_DATA'
  | 'INVALID_IRI_VALUE'
  | 'MATERIALIZATION_FAILED'
  | 'MISSING_GRAPH_IRI'
  | 'NON_FINITE_NUMBER';

/**
 * Error codes emitted by `OwlImportError`.
 *
 * @remarks
 * Produced when the OWL importer encounters a construct it does not yet
 * support. Currently only `OWL_IMPORT_NOT_IMPLEMENTED` is defined; future
 * versions may expand this union as more OWL axioms are handled.
 *
 * @example
 * ```ts
 * import type { OwlImportErrorCodeType } from 'json-tology/types';
 * function handleOwlImport(code: OwlImportErrorCodeType): void {
 *   if (code === 'OWL_IMPORT_NOT_IMPLEMENTED') { /* ... *\/ }
 * }
 * ```
 *
 * @category Error Codes
 * @since 0.1.0
 * @see {@link GraphErrorCodeType}
 * @group Error Codes
 */
export type OwlImportErrorCodeType = 'OWL_IMPORT_NOT_IMPLEMENTED';
