/**
 * Schema loader types — expressed as json-tology schemas.
 */

import type { InferType } from './Schema.js';
import type {
  SCHEMA_LOAD_ERROR_SCHEMA, SCHEMA_LOAD_RESULT_SCHEMA
} from '../constants/SCHEMAS.js';
import type { JsonSchemaType } from './Schema.js';

/**
 * TypeScript type inferred from `SCHEMA_LOAD_ERROR_SCHEMA` — describes a single schema-load failure.
 *
 * @remarks
 * Produced by the schema loader when a load attempt fails. Shape: `{ file, message, reason, status? }`.
 * `file` is the source path or IRI that was being loaded. `reason` is a string enum
 * classifying the failure (e.g. `'missing-id'`, `'fetch-failed'`, `'invalid-schema'`).
 * `status` is an optional numeric HTTP status code present only on remote fetch failures.
 * The shape is derived from the canonical schema constant so it stays in sync with the
 * runtime representation.
 *
 * @example
 * ```ts
 * const err: SchemaLoadErrorType = {
 *   file: 'https://example.com/User',
 *   message: 'HTTP 503 loading schema',
 *   reason: 'fetch-failed',
 *   status: 503,
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link SchemaLoadResultType}
 * @group Schema Utilities
 */
export type SchemaLoadErrorType = InferType<typeof SCHEMA_LOAD_ERROR_SCHEMA>;

/**
 * Union of all valid `reason` values for a schema-load failure.
 *
 * @remarks
 * Derived from `SchemaLoadErrorType['reason']` so it stays in sync with the
 * enum defined in `SCHEMA_LOAD_ERROR_SCHEMA`.
 *
 * @category Schema Utilities
 * @since 0.25.0
 * @see {@link SchemaLoadErrorType}
 * @group Schema Utilities
 */
export type SchemaLoadReasonType = SchemaLoadErrorType['reason'];

/**
 * TypeScript type inferred from `SCHEMA_LOAD_RESULT_SCHEMA` — describes the aggregate outcome of a bulk schema-load operation.
 *
 * @remarks
 * Summarises loading one or more schemas. Shape: `{ successful, skipped, failed, errors }`.
 * `successful` is the count of schemas that loaded without error. `skipped` is the count
 * of IRIs already registered. `failed` is the count of schemas that could not be loaded.
 * `errors` is an array of `SchemaLoadErrorType` descriptors, one per failure.
 * The shape is derived from the canonical schema constant so it stays in sync with the
 * runtime representation.
 *
 * @example
 * ```ts
 * const result: SchemaLoadResultType = {
 *   errors: [],
 *   failed: 0,
 *   skipped: 1,
 *   successful: 5,
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link SchemaLoadErrorType}
 * @group Schema Utilities
 */
export type SchemaLoadResultType = InferType<typeof SCHEMA_LOAD_RESULT_SCHEMA>;

/**
 * Pluggable async schema loader hook.
 *
 * @remarks
 * Called by `JsonTology.prefetch` during transitive `$ref` resolution when a
 * referenced IRI is not yet registered. Returns the parsed schema object for
 * the given IRI, or `null` if the IRI is unknown to this loader. Returning
 * `null` causes `GraphError` `REF_UNRESOLVED` to be thrown with the IRI;
 * returning a schema whose `$id` is not a string causes `SchemaLoadError`
 * (`reason: 'missing-id'`). Network errors should propagate so callers see real
 * connectivity failures.
 *
 * @example
 * ```ts
 * const loader: LoaderType = async (iri) => {
 *   const res = await fetch(iri);
 *   return res.ok ? (await res.json() as JsonSchemaType) : null;
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link SchemaLoadResultType}
 * @group Schema Utilities
 */
export type LoaderType = (iri: string) => Promise<JsonSchemaType | null>;
