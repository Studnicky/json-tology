import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

declare const TRANSFORM_OUT: unique symbol;
declare const CATCH_BRAND: unique symbol;

export type TransformBrand<TOut>  = { readonly [TRANSFORM_OUT]: TOut };
export type CatchBrand<TFallback> = { readonly [CATCH_BRAND]: TFallback };

/**
 * A schema annotated with a transform.
 * `Infer<T>` still gives the JSON-level type; `ParseOutput<T>` gives the decoded type.
 */
export type Transformed<TSchema, TOut> = TSchema & TransformBrand<TOut>;

/**
 * A schema annotated with a fallback value for use in safeParse/withCatch.
 */
export type WithCatchSchema<TSchema, TFallback> = TSchema & CatchBrand<TFallback>;

/**
 * Resolve the output type of parse() for a schema.
 * - Transformed schemas return the decoded TOut.
 * - All other schemas return the standard FromSchema result.
 */
export type ParseOutput<TSchema> =
  TSchema extends TransformBrand<infer Out> ? Out : FromSchema<TSchema & JSONSchema>;
