/**
 * Function that resolves a schema ID to its raw JSON Schema object, or undefined if not registered.
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 */
export interface LookupSchemaFunctionInterface {
  (id: string): Record<string, unknown> | undefined;
  readonly 'lookupSchemaFunctionBrand'?: unique symbol;
}
