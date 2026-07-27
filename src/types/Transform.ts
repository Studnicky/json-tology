import type { ComputedExtensionBrandType } from '../types/ComputedExtensionBrandType.js';
import type { TransformBrandInterface } from '../interfaces/TransformBrandInterface.js';
import type { AnyTransformStageInterface } from '../interfaces/AnyTransformStageInterface.js';
import type { InferSchemaType } from './Infer.js';
import type { JsonTologyReferencesInterface } from '../interfaces/JsonTologyReferencesInterface.js';
import type { ChainRecursionCapEntity } from '../entities/ChainRecursionCapEntity.js';
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
 *
 * No-fix exception: `@studnicky/type-alias-invariants` flags this alias because
 * `TransformBrandInterface<TWire>` is a behavioral brand contract, and `TSchema` is
 * a free type parameter — TypeScript interfaces cannot `extends` a bare type
 * parameter, so there is no interface form; this stays a `type` intersection.
 */
export type TransformedType<TSchema, TWire> = TransformBrandInterface<TWire> & TSchema;

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
  = TSchema extends TransformBrandInterface<unknown>
    ? InferSchemaType<TSchema, TSchema, TReferences>
    : InferSchemaType<TSchema, TSchema, TReferences>
      & (TSchema extends ComputedExtensionBrandType<infer TFields> ? TFields : unknown);

/**
 * Extract the raw wire type recorded on a transformed schema, or `never` when
 * the schema carries no transform brand.
 */
export type TransformWireType<TSchema>
  = TSchema extends TransformBrandInterface<infer TWire> ? TWire : never;

// ---------------------------------------------------------------------------
// Chain compatibility (compile-time pairwise validation)
// ---------------------------------------------------------------------------

/**
 * Recursion budget for chain validation. Chains longer than this fall
 * through unchecked.
 */

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
  TStages extends AnyTransformStageInterface[],
  TCanonical,
  TIndex extends unknown[] = []
> = TIndex['length'] extends ChainRecursionCapEntity.Type
  ? TStages
  : TStages extends [infer THead, ...infer TRest]
    ? TRest extends AnyTransformStageInterface[]
      ? THead extends { 'decode': (input: never) => infer TOutHead }
        ? TRest extends []
          ? TOutHead extends TCanonical
            ? [THead]
            : [ChainSchemaMismatchType<TCanonical, TOutHead>]
          : TRest extends [
            { 'decode': (input: infer TInNext) => unknown },
            ...unknown[]
          ]
            ? TOutHead extends TInNext
              ? [
                THead,
                ...ValidateChainType<TRest, TCanonical, [...TIndex, unknown]>
              ]
              : [
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
export type ChainWireType<TStages extends AnyTransformStageInterface[]>
  = TStages extends [infer THead, ...unknown[]]
    ? THead extends { 'decode': (input: infer TIn) => unknown } ? TIn : unknown
    : unknown;
