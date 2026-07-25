import type { ComputedFunctionType } from '../types/ComputedFunctionType.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/**
 * Interface contract for the computed-field store.
 *
 * Records `jt:computed` handler functions per schema. Consulted by
 * `SchemaRegistry.instantiate` and `Materializer` when synthesizing
 * computed property values.
 */
export interface ComputedStoreInterface {
  add(schemaId: string, name: string, fn: ComputedFunctionType): void;
  getMap(schemaId: string): Record<string, ComputedFunctionType>;
  has(schemaId: string): boolean;
  remove(schemaId: string, name: string): void;
  validateAgainstGraph(graph: SchemaGraphInterface): void;
}
