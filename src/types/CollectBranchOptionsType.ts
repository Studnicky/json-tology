import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { BranchScanStateType } from './BranchScanStateType.js';

/** Options for `collectBranchPropertyNames`. */
export type CollectBranchOptionsType
  = { 'branchNode': SchemaGraphNodeType }
    & { 'scanState': BranchScanStateType }
    & { 'startGraph': SchemaGraphInterface };
