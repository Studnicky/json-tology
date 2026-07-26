/** A `jt:computed` handler: derives a property's value from the instance's other fields. */
export interface ComputedFunctionInterface {
  (data: Record<string, unknown>): unknown;
}
