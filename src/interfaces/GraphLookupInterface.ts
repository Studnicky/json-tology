import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/**
 * Resolves a raw JSON Schema object to its pre-compiled graph, when one exists.
 *
 * A callable signature, not schema-derived data — authored as an interface
 * with a call signature rather than a type alias.
 */
export interface GraphLookupInterface {
  (schema: Record<string, unknown>): SchemaGraphInterface | undefined;
}
