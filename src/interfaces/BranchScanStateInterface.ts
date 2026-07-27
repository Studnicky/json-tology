import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { ConditionalPropertyKeySetInterface } from './ConditionalPropertyKeySetInterface.js';

/** Shared mutable state for the conditional-branch property scan. */
export interface BranchScanStateInterface {
  'collectVisited': Set<SchemaGraphNodeInterface>;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'scanVisited': Set<SchemaGraphNodeInterface>;
  'target': ConditionalPropertyKeySetInterface;
}
