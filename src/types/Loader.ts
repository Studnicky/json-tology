/**
 * Schema loader types — expressed as json-tology schemas.
 */

import type { InferType } from './Schema.js';
import type {
  SchemaLoadErrorSchema, SchemaLoadResultSchema
} from '../constants/SCHEMAS.js';
import type { JsonSchemaType } from './Schema.js';

export type SchemaLoadErrorType = InferType<typeof SchemaLoadErrorSchema>;
export type SchemaLoadResultType = InferType<typeof SchemaLoadResultSchema>;

/**
 * Pluggable async schema loader hook.
 *
 * Called by {@link JsonTology.create} (and {@link JsonTology.registerAsync}) during the
 * eager $ref-resolution walk when a referenced IRI is not yet registered. Returns the
 * parsed schema object for the given IRI, or `null` if the IRI is unknown to this loader.
 * Returning `null` causes {@link GraphError} `REF_UNRESOLVED` to be thrown with the IRI.
 * Network errors should propagate (throw) so callers see real connectivity failures.
 */
export type LoaderType = (iri: string) => Promise<JsonSchemaType | null>;
