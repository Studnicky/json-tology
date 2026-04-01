import type { TransformBrandInterface } from '../interfaces/TransformBrand.js';
import type { InferSchemaType } from './Infer.js';

/**
 * A schema annotated with a transform.
 * `InferType<T>` still gives the JSON-level type; `ParseOutputType<T>` gives the decoded type.
 */
export type TransformedType<TSchema, TOut> = TransformBrandInterface<TOut> & TSchema;

/**
 * Resolve the output type of parse() for a schema.
 * - TransformedType schemas return the decoded TOut.
 * - All other schemas return the standard inferred result.
 *
 * @typeParam TReferences - Cross-schema references map for $ref resolution.
 */
export type ParseOutputType<TSchema, TReferences = Record<never, never>>
  = TSchema extends TransformBrandInterface<infer Out> ? Out : InferSchemaType<TSchema, TSchema, TReferences>;
