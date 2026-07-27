/**
 * A single stage in a {@link Transform.chain} chain.
 *
 * Each stage maps a wire-form input `TIn` to a decoded output `TOut`,
 * and back. Stages are composable: stage N's `TOut` becomes stage N+1's
 * `TIn`. Compile-time pairwise validation is performed by
 * `ValidateChainType` in `src/types/Transform.js`.
 */
export interface TransformStageInterface<TIn, TOut> {
  'decode': (input: TIn) => TOut;
  'encode': (output: TOut) => TIn;
}
