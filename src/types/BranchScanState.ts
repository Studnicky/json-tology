import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { ConditionalPropertyKeySetType } from '../types/Validation.js';

/** Shared mutable state for the conditional-branch property scan. */
export type BranchScanStateType = {
  readonly 'collectVisited': Set<SchemaGraphNodeType>;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'scanVisited': Set<SchemaGraphNodeType>;
  readonly 'target': ConditionalPropertyKeySetType;
};
