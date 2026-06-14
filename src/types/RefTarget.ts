import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

export type RefTargetType = {
  readonly 'graph': SchemaGraphInterface;
  readonly 'node': SchemaGraphNodeType;
};
