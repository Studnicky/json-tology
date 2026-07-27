/**
 * Bivariant-friendly upper bound for any chain stage. Function parameters
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
