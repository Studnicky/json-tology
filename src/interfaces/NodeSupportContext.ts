import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Shared traversal context for node-support checks. */
export interface NodeSupportContextInterface {
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'visited': Set<SchemaGraphNodeInterface | string>;
}
