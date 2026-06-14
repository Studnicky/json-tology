import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { BranchScanStateType } from './BranchScanState.js';

/** Options for `resolveScanRef`. */
export type ResolveScanRefOptionsType = {
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'ref': string;
  readonly 'scanState': BranchScanStateType;
};
