/**
 * A `jt:computed` handler: derives a property's value from the instance's other fields.
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 */
export interface ComputedFunctionInterface {
  (data: Record<string, unknown>): unknown;
  readonly 'computedFunctionBrand'?: unique symbol;
}
