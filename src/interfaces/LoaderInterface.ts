import type { JsonSchemaType } from '../types/Schema.js';

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
 * const loader: LoaderInterface = async (iri) => {
 *   const res = await fetch(iri);
 *   return res.ok ? (await res.json() as JsonSchemaType) : null;
 * };
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link SchemaLoadResultEntity}
 * @group Schema Utilities
 */
export interface LoaderInterface {
  (iri: string): Promise<JsonSchemaType | null>;
}
