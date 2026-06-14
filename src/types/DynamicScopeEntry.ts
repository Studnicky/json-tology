import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

export type DynamicScopeEntryType = {
  'anchor': string;
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeType;
};
