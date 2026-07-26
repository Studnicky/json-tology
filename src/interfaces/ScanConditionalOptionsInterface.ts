import type { SchemaGraphSemanticsInterface } from './SchemaGraphSemanticsInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { BranchScanStateInterface } from './BranchScanStateInterface.js';

/** Options for `scanForConditionalBranches`. */
export interface ScanConditionalOptionsInterface {
  'currentGraph': SchemaGraphInterface;
  'scanSem': SchemaGraphSemanticsInterface;
  'scanState': BranchScanStateInterface;
}
