import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { IdentityType } from './IdentityType.js';

export type DynamicScopeEntryType = IdentityType<{
  'anchor': string;
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeType;
}>;
