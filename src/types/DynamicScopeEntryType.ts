import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

export type DynamicScopeEntryType = {
  'anchor': string;
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeType;
};
