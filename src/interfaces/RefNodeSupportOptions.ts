import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Options for `checkRefNodeSupport`. */
export interface RefNodeSupportOptionsInterface {
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'ref': string;
  readonly 'refTargetNode': SchemaGraphNodeInterface | undefined;
  readonly 'visited': Set<SchemaGraphNodeInterface | string>;
}
