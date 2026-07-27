import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/**
 * Resolves a raw JSON Schema object to its pre-compiled graph, when one exists.
 *
 * A callable signature, not schema-derived data — authored as an interface
 * with a call signature rather than a type alias. Carries a `unique symbol`
 * brand member alongside the call signature so it has real contract evidence
 * beyond "only a call signature" (optional, so plain function values still
 * satisfy the interface structurally).
 */
export interface GraphLookupInterface {
  (schema: Record<string, unknown>): SchemaGraphInterface | undefined;
  readonly 'graphLookupBrand'?: unique symbol;
}
