import type { InferSchemaType } from './infer.js';

declare const TRANSFORM_OUT: unique symbol;

export interface TransformBrandInterface<TOut> { readonly [TRANSFORM_OUT]: TOut }

/**
 * A schema annotated with a transform.
 * `Infer<T>` still gives the JSON-level type; `ParseOutputType<T>` gives the decoded type.
 */
export type TransformedType<TSchema, TOut> = TransformBrandInterface<TOut> & TSchema;

/**
 * Resolve the output type of parse() for a schema.
 * - TransformedType schemas return the decoded TOut.
 * - All other schemas return the standard inferred result.
 */
export type ParseOutputType<TSchema>
  = TSchema extends TransformBrandInterface<infer Out> ? Out : InferSchemaType<TSchema>;
