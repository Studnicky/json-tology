/**
 * Schema loader types — expressed as json-tology schemas.
 */

import type { InferType } from './Schema.js';
import type {
  SchemaLoadErrorSchema, SchemaLoadResultSchema
} from '../constants/SCHEMAS.js';
import type { JsonSchemaType } from './Schema.js';

/**
 * TypeScript type inferred from `SchemaLoadErrorSchema` — describes a single schema-load failure.
 *
 * @remarks
 * Produced by the schema loader when a fetch attempt fails. Carries the IRI
 * that was requested, a human-readable `message`, and an optional numeric
 * `status` code (e.g. HTTP status). The shape is derived from the canonical
 * schema constant so it stays in sync with the runtime representation.
 *
 * @example
 * ```ts
 * const err: SchemaLoadErrorType = {
 *   iri: 'https://example.com/User',
 *   message: 'Not Found',
 *   status: 404,
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link SchemaLoadResultType}
 * @group Schema Utilities
 */
export type SchemaLoadErrorType = InferType<typeof SchemaLoadErrorSchema>;

/**
 * TypeScript type inferred from `SchemaLoadResultSchema` — describes the outcome of a single schema-load attempt.
 *
 * @remarks
 * Returned by the loader registry after attempting to fetch a referenced IRI.
 * On success carries the parsed `schema` object; on failure carries a
 * `SchemaLoadErrorType` describing the failure. The shape is derived from the
 * canonical schema constant so it stays in sync with the runtime representation.
 *
 * @example
 * ```ts
 * const result: SchemaLoadResultType = { iri: 'https://example.com/User', schema: userJson };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link SchemaLoadErrorType}
 * @group Schema Utilities
 */
export type SchemaLoadResultType = InferType<typeof SchemaLoadResultSchema>;

/**
 * Pluggable async schema loader hook.
 *
 * @remarks
 * Called by `JsonTology.prefetch` during transitive `$ref` resolution when a
 * referenced IRI is not yet registered. Returns the parsed schema object for
 * the given IRI, or `null` if the IRI is unknown to this loader. Returning
 * `null` causes `GraphError` `REF_UNRESOLVED` to be thrown with the IRI.
 * Network errors should propagate so callers see real connectivity failures.
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
