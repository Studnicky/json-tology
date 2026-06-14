import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { GraphLookupContextType } from './GraphLookupContext.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Shared traversal context for node-support checks. */
export type NodeSupportContextType = GraphLookupContextType & {
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'visited': Set<SchemaGraphNodeType | string>;
};
