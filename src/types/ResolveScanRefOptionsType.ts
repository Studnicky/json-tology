import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { BranchScanStateType } from './BranchScanStateType.js';

/** Options for `resolveScanRef`. */
export type ResolveScanRefOptionsType = {
  'currentGraph': SchemaGraphInterface;
  'ref': string;
  'scanState': BranchScanStateType;
};
