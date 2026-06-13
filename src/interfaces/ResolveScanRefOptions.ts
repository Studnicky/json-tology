import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { BranchScanStateInterface } from './BranchScanState.js';

/** Options for `resolveScanRef`. */
export interface ResolveScanRefOptionsInterface {
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'ref': string;
  readonly 'scanState': BranchScanStateInterface;
}
