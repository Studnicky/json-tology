import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphSemanticsType } from './SchemaGraph.js';
import type { BranchScanStateType } from './BranchScanState.js';

/** Options for `scanForConditionalBranches`. */
export type ScanConditionalOptionsType = {
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'scanSem': SchemaGraphSemanticsType;
  readonly 'scanState': BranchScanStateType;
};
