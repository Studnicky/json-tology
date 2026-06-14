import type { ComputedExtensionBrandType } from '../types/ComputedExtension.js';
import type { TransformBrandType } from '../types/TransformBrand.js';
import type { AnyTransformStageType } from '../types/TransformStage.js';
import type { InferSchemaType } from './Infer.js';
import type { JsonTologyReferencesInterface } from './SchemaReferences.js';
import type {
  ChainMismatchType,
  ChainSchemaMismatchType
} from './TypeErrors.js';

/**
 * A schema annotated with a normalize transform.
 *
 * `decode` consumes the raw wire type `TWire` and produces the schema's
 * canonical form; the brand records `TWire` so `encode`/`dump` can recover the
 * wire representation. `InferType<T>` still gives the JSON-level type;
 * `ParseOutputType<T>` gives the canonical (validated) type.
 */
export type TransformedType<TSchema, TWire> = TransformBrandType<TWire> & TSchema;

/**
 * Resolve the output type of instantiate() for a schema.
 * - Transformed schemas resolve to the schema's canonical `InferSchemaType` —
 *   a normalize transform always produces the schema-conforming form.
 * - All other schemas return the standard inferred result, intersected with
 *   any computed-field extensions registered via `addComputed` (encoded as
 *   `ComputedExtensionBrandType` on the raw schema entry in `TRefs`).
 *
 * @typeParam TReferences - Cross-schema references map for $ref resolution.
 */
export type ParseOutputType<TSchema, TReferences = JsonTologyReferencesInterface>
  = TSchema extends TransformBrandType<unknown>
    ? InferSchemaType<TSchema, TSchema, TReferences>
    : InferSchemaType<TSchema, TSchema, TReferences>
      & (TSchema extends ComputedExtensionBrandType<infer TFields> ? TFields : unknown);

/**
 * Extract the raw wire type recorded on a transformed schema, or `never` when
 * the schema carries no transform brand.
 */
export type TransformWireType<TSchema>
  = TSchema extends TransformBrandType<infer TWire> ? TWire : never;

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
 * Walk a chain pairwise and verify each stage's output type matches the next
 * stage's input type, and that the LAST stage's output matches the schema's
 * canonical type `TCanonical`. Each element in the resulting tuple is either:
 *   - the original stage type (compatibility holds), or
 *   - a `ChainMismatchType` brand (an interior pair is broken), or
 *   - a `ChainSchemaMismatchType` brand (the tail does not produce the
 *     schema's canonical form).
 *
 * A normalize chain decodes the raw wire type (the FIRST stage's free input)
 * into the schema's canonical form (the LAST stage's output). The head input
 * is therefore unconstrained; the tail output is anchored to `TCanonical`.
 *
 * The validator infers stage in/out types from each stage's `decode` function
 * shape so that contravariance does not interfere with inference. Applying this
 * type to the `stages` parameter forces the call site to be rejected when any
 * pair — or the tail — fails.
 */
export type ValidateChainType<
  TStages extends readonly AnyTransformStageType[],
  TCanonical,
  TIndex extends readonly unknown[] = readonly []
> = TIndex['length'] extends ChainRecursionCap
  ? TStages
  : TStages extends readonly [infer THead, ...infer TRest]
    ? TRest extends readonly AnyTransformStageType[]
      ? THead extends { 'decode': (input: never) => infer TOutHead }
        ? TRest extends readonly []
          ? TOutHead extends TCanonical
            ? readonly [THead]
            : readonly [ChainSchemaMismatchType<TCanonical, TOutHead>]
          : TRest extends readonly [
            { 'decode': (input: infer TInNext) => unknown },
            ...readonly unknown[]
          ]
            ? TOutHead extends TInNext
              ? readonly [
                THead,
                ...ValidateChainType<TRest, TCanonical, readonly [...TIndex, unknown]>
              ]
              : readonly [
                THead,
                ChainMismatchType<TIndex['length'], TOutHead, TInNext>,
                ...TRest
              ]
            : TStages
        : TStages
      : TStages
    : TStages;

/**
 * The raw wire type a chain consumes — the `decode` input type of its first
 * stage. Recorded on the transformed schema's brand so `encode`/`dump` can
 * recover the wire form.
 */
export type ChainWireType<TStages extends readonly AnyTransformStageType[]>
  = TStages extends readonly [infer THead, ...readonly unknown[]]
    ? THead extends { 'decode': (input: infer TIn) => unknown } ? TIn : unknown
    : unknown;
