import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { BranchScanStateInterface } from './BranchScanState.js';

/** Options for `collectBranchPropertyNames`. */
export interface CollectBranchOptionsInterface {
  readonly 'branchNode': SchemaGraphNodeInterface;
  readonly 'scanState': BranchScanStateInterface;
  readonly 'startGraph': SchemaGraphInterface;
}
