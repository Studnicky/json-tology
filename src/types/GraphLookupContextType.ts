import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupGraphFnType } from './LookupGraphFnType.js';

/** Shared graph-lookup context: the compiled graph and its optional cross-schema resolver. */
export type GraphLookupContextType = {
  'graph': SchemaGraphInterface;
  'lookupGraph': LookupGraphFnType | undefined;
};
