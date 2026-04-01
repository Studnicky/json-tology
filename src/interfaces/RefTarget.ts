import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface RefTargetInterface {
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}
