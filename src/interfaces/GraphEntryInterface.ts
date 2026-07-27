import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/**
 * Result of {@link SchemaRegistryInterface.graphEntry} — pairs a registered
 * schema with its canonical graph.
 */
export interface GraphEntryInterface {
  'graph': SchemaGraphInterface;
  'schema': Record<string, unknown>;
}
