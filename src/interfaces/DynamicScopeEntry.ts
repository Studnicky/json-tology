import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface DynamicScopeEntryInterface {
  'anchor': string;
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}
