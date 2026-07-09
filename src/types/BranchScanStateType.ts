import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { ConditionalPropertyKeySetType } from '../types/Validation.js';

/** Shared mutable state for the conditional-branch property scan. */
export type BranchScanStateType = {
  'collectVisited': Set<SchemaGraphNodeType>;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'scanVisited': Set<SchemaGraphNodeType>;
  'target': ConditionalPropertyKeySetType;
};
