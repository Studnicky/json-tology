import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { ConditionalPropertyKeySetType } from '../types/Validation.js';

/** Shared mutable state for the conditional-branch property scan. */
export interface BranchScanStateInterface {
  readonly 'collectVisited': Set<SchemaGraphNodeInterface>;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'scanVisited': Set<SchemaGraphNodeInterface>;
  readonly 'target': ConditionalPropertyKeySetType;
}
