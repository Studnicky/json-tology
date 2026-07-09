import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphSemanticsType } from './SchemaGraph.js';
import type { BranchScanStateType } from './BranchScanStateType.js';

/** Options for `scanForConditionalBranches`. */
export type ScanConditionalOptionsType = {
  'currentGraph': SchemaGraphInterface;
  'scanSem': SchemaGraphSemanticsType;
  'scanState': BranchScanStateType;
};
