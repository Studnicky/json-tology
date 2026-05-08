/**
 * A single stage in a {@link Transform.pipe} chain.
 *
 * Each stage maps a wire-form input `TIn` to a decoded output `TOut`,
 * and back. Stages are composable: stage N's `TOut` becomes stage N+1's
 * `TIn`. Compile-time pairwise validation is performed by
 * `ValidatePipeChainType` in `src/types/Transform.js`.
 */
export interface TransformStageInterface<TIn, TOut> {
  'decode': (input: TIn) => TOut;
  'encode': (output: TOut) => TIn;
}

/**
 * Bivariant-friendly upper bound for any pipe stage. Function parameters
 * use `never` so any concrete stage type is assignable under strict
 * function types: `(input: T) => unknown` is a subtype of
 * `(input: never) => unknown` for every `T`. The bound is structurally
 * compatible with `TransformStageInterface<TIn, TOut>` for all valid
 * `TIn` / `TOut`, which lets generic constraints accept arbitrary
 * specialisations without resorting to `any`.
 */
export interface AnyTransformStageInterface {
  'decode': (input: never) => unknown;
  'encode': (output: never) => unknown;
}
