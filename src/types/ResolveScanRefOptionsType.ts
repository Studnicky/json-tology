import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { BranchScanStateType } from './BranchScanStateType.js';

/** Options for `resolveScanRef`. */
export type ResolveScanRefOptionsType = {
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'ref': string;
  readonly 'scanState': BranchScanStateType;
};
