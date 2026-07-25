import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { BranchScanStateType } from './BranchScanStateType.js';
import type { InferType } from './Schema.js';

export const RESOLVE_SCAN_REFERENCE_DATA_SCHEMA = {
  'properties': { 'ref': { 'type': 'string' } },
  'required': ['ref'],
  'type': 'object'
} as const;

/** Options for `resolveScanRef`. */
export type ResolveScanReferenceOptionsType = InferType<typeof RESOLVE_SCAN_REFERENCE_DATA_SCHEMA> & {
  'currentGraph': SchemaGraphInterface;
  'scanState': BranchScanStateType;
};
