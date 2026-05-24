import type { ComputedFnType } from '../types/Computed.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

/**
 * Interface contract for the computed-field store.
 *
 * Records `jt:computed` handler functions per schema. Consulted by
 * `SchemaRegistry.instantiate` and `Materializer` when synthesizing
 * computed property values.
 */
export interface ComputedStoreInterface {
  add(schemaId: string, name: string, fn: ComputedFnType): void;
  getMap(schemaId: string): Record<string, ComputedFnType>;
  has(schemaId: string): boolean;
  remove(schemaId: string, name: string): void;
  validateAgainstGraph(graph: SchemaGraphInterface): void;
}
