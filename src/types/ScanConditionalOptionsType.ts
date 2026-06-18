import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphSemanticsType } from './SchemaGraph.js';
import type { BranchScanStateType } from './BranchScanStateType.js';

/** Options for `scanForConditionalBranches`. */
export type ScanConditionalOptionsType = {
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'scanSem': SchemaGraphSemanticsType;
  readonly 'scanState': BranchScanStateType;
};
