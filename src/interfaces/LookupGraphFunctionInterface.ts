import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/**
 * Function that resolves a schema ID to its compiled graph, or undefined if not registered.
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 */
export interface LookupGraphFunctionInterface {
  (schemaId: string): SchemaGraphInterface | undefined;
  readonly 'lookupGraphFunctionBrand'?: unique symbol;
}
