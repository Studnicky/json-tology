import type { JsonTologyReferencesInterface } from '../interfaces/JsonTologyReferencesInterface.js';
import type { InferSchemaType } from './Infer.js';

/**
 * A partial view over {@link InferSchemaType}`<TSchema, TRoot, TReferences>`, for the
 * `partial` input argument of {@link MaterializerInterface.materialize}.
 *
 * Expressed as a mapped type (rather than `Partial<InferSchemaType<TSchema>>`)
 * because `TSchema` is a local generic type parameter and `InferSchemaType`
 * is itself a canonical codebase-owned type — see `whole-canonical-types`.
 *
 * @typeParam TSchema - The schema type (should be `as const`).
 * @typeParam TRoot - The root schema for $ref resolution (defaults to TSchema).
 * @typeParam TReferences - Map of external schema IRIs to their types.
 */
export type PartialInferSchemaType<TSchema, TRoot = TSchema, TReferences = JsonTologyReferencesInterface> = {
  [Key in keyof InferSchemaType<TSchema, TRoot, TReferences>]?: InferSchemaType<TSchema, TRoot, TReferences>[Key];
};
