import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { BranchScanStateInterface } from './BranchScanStateInterface.js';

/** Options for `collectBranchPropertyNames`. */
export interface CollectBranchOptionsInterface {
  'branchNode': SchemaGraphNodeInterface;
  'scanState': BranchScanStateInterface;
  'startGraph': SchemaGraphInterface;
}
