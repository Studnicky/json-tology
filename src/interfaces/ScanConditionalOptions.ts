import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaGraphSemanticsInterface } from './SchemaGraph.js';
import type { BranchScanStateInterface } from './BranchScanState.js';

/** Options for `scanForConditionalBranches`. */
export interface ScanConditionalOptionsInterface {
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'scanSem': SchemaGraphSemanticsInterface;
  readonly 'scanState': BranchScanStateInterface;
}
