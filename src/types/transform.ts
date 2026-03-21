import type { TransformBrandInterface } from '../interfaces/transform-brand.js';
import type { InferSchemaType } from './infer.js';

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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ParseOutputType<TSchema, TReferences = {}>
  = TSchema extends TransformBrandInterface<infer Out> ? Out : InferSchemaType<TSchema, TSchema, TReferences>;
