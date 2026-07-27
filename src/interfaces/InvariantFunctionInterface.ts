/**
 * A caller-supplied invariant check: returns an error message (or `null`/`undefined` when valid).
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 */
export interface InvariantFunctionInterface<T = unknown> {
  (value: T): null | string | undefined;
  readonly 'invariantFunctionBrand'?: unique symbol;
}
