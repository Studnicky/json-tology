import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { BranchScanStateType } from './BranchScanState.js';

/** Options for `collectBranchPropertyNames`. */
export type CollectBranchOptionsType = {
  readonly 'branchNode': SchemaGraphNodeType;
  readonly 'scanState': BranchScanStateType;
  readonly 'startGraph': SchemaGraphInterface;
};
