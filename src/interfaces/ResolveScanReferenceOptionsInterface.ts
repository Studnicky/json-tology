import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { BranchScanStateInterface } from './BranchScanStateInterface.js';
import type { ReferenceValueEntity } from '../entities/ReferenceValueEntity.js';

/** Options for `resolveScanRef`. */
export interface ResolveScanReferenceOptionsInterface {
  'currentGraph': SchemaGraphInterface;
  'ref': ReferenceValueEntity.Type;
  'scanState': BranchScanStateInterface;
}
