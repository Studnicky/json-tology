import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/**
 * Result of {@link SchemaRegistryInterface.graphEntry} — pairs a registered
 * schema with its canonical graph.
 */
export type GraphEntryType = {
  'graph': SchemaGraphInterface;
  'schema': Record<string, unknown>;
};
