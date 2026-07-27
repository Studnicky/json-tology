import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { LookupGraphFunctionInterface } from './LookupGraphFunctionInterface.js';

/** Shared graph-lookup context: the compiled graph and its optional cross-schema resolver. */
export interface GraphLookupContextInterface {
  'graph': SchemaGraphInterface;
  'lookupGraph': LookupGraphFunctionInterface | undefined;
}
