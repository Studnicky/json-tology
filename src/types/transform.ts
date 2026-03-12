import type { InferSchema } from './infer.js';

declare const TRANSFORM_OUT: unique symbol;
declare const CATCH_BRAND: unique symbol;

export interface TransformBrand<TOut> { readonly [TRANSFORM_OUT]: TOut }
export interface CatchBrand<TFallback> { readonly [CATCH_BRAND]: TFallback }

/**
 * A schema annotated with a transform.
 * `Infer<T>` still gives the JSON-level type; `ParseOutput<T>` gives the decoded type.
 */
export type Transformed<TSchema, TOut> = TransformBrand<TOut> & TSchema;

/**
 * A schema annotated with a fallback value for use in safeParse/withCatch.
 */
export type WithCatchSchema<TSchema, TFallback> = CatchBrand<TFallback> & TSchema;

/**
 * Resolve the output type of parse() for a schema.
 * - Transformed schemas return the decoded TOut.
 * - All other schemas return the standard inferred result.
 */
export type ParseOutput<TSchema>
  = TSchema extends TransformBrand<infer Out> ? Out : InferSchema<TSchema>;
