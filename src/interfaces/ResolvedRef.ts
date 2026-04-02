import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface ResolvedRefInterface {
  readonly 'graph': SchemaGraphInterface;
  readonly 'node': SchemaGraphNodeInterface;
}
