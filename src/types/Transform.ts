import type { TransformBrandInterface } from '../interfaces/TransformBrand.js';
import type { AnyTransformStageInterface } from '../interfaces/TransformStage.js';
import type { InferSchemaType } from './Infer.js';
import type {
  ChainMismatchInterface,
  ChainSchemaMismatchInterface
} from './TypeErrors.js';

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

// ---------------------------------------------------------------------------
// Chain compatibility (compile-time pairwise validation)
// ---------------------------------------------------------------------------

/**
 * Recursion budget for chain validation. Matches the project-wide
 * `TupleRecursionCap` in `Infer.ts`. Chains longer than this fall through
 * unchecked.
 */
type ChainRecursionCap = 10;

/**
 * Walk a chain pairwise and verify each stage's output type matches
 * the next stage's input type. Each element in the resulting tuple is
 * either:
 *   - the original stage type (compatibility holds), or
 *   - a `ChainMismatchInterface` brand (the chain is broken).
 *
 * Additionally, the first stage's input type must accept the schema's
 * wire-form type `TWire`; otherwise the first element resolves to a
 * `ChainSchemaMismatchInterface` brand.
 *
 * The validator infers stage in/out types from each stage's `decode`
 * function shape so that contravariance does not interfere with the
 * inference of `TInNext` from a generic-bound stage.
 *
 * Applying this type to the `stages` parameter forces the call site to
 * be rejected when any pair fails: the user's literal stages are not
 * assignable to a tuple containing an error-branded element of a
 * different length.
 */
export type ValidateChainType<
  TStages extends readonly AnyTransformStageInterface[],
  TWire,
  TIndex extends readonly unknown[] = readonly []
> = TIndex['length'] extends ChainRecursionCap
  ? TStages
  : TStages extends readonly [infer THead, ...infer TRest]
    ? TRest extends readonly AnyTransformStageInterface[]
      ? THead extends { 'decode': (input: TWire) => infer TOutHead }
        ? TRest extends readonly []
          ? readonly [THead]
          : TRest extends readonly [
            { 'decode': (input: infer TInNext) => unknown },
            ...readonly unknown[]
          ]
            ? TOutHead extends TInNext
              ? readonly [
                THead,
                ...ValidateChainType<TRest, TOutHead, readonly [...TIndex, unknown]>
              ]
              : readonly [
                THead,
                ChainMismatchInterface<TIndex['length'], TOutHead, TInNext>,
                ...TRest
              ]
            : TStages
        : THead extends { 'decode': (input: infer TInHead) => unknown }
          ? readonly [
            ChainSchemaMismatchInterface<TWire, TInHead>,
            ...TRest
          ]
          : TStages
      : TStages
    : TStages;

/**
 * Extract the final decoded output type of a chain — the `TOut` of
 * the last stage. Used to type `Transform.chain`'s return value so the
 * resulting schema's `ParseOutputType` matches the chain's terminal type.
 *
 * Inferred from each stage's `decode` return type to avoid the variance
 * issues described on `ValidateChainType`.
 */
export type ChainOutputType<
  TStages extends readonly AnyTransformStageInterface[],
  TIndex extends readonly unknown[] = readonly []
> = TIndex['length'] extends ChainRecursionCap
  ? unknown
  : TStages extends readonly [infer TOnly]
    ? TOnly extends { 'decode': (input: never) => infer TOut }
      ? TOut
      : unknown
    : TStages extends readonly [AnyTransformStageInterface, ...infer TRest]
      ? TRest extends readonly AnyTransformStageInterface[]
        ? ChainOutputType<TRest, readonly [...TIndex, unknown]>
        : unknown
      : unknown;
