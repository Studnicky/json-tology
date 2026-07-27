import type { SchemaRegistryInterface } from './SchemaRegistryInterface.js';

/**
 * Callback signature for {@link SchemaRegistryInterface.forEach}.
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 */
export interface SchemaRegistryForEachCallbackInterface {
  (schema: Record<string, unknown>, schemaId: string, registry: SchemaRegistryInterface): void;
  readonly 'schemaRegistryForEachCallbackBrand'?: unique symbol;
}
