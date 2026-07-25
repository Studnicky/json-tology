import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupGraphFunctionType } from './LookupGraphFunctionType.js';
import type { IdentityType } from './IdentityType.js';

/** Shared graph-lookup context: the compiled graph and its optional cross-schema resolver. */
export type GraphLookupContextType = IdentityType<{
  'graph': SchemaGraphInterface;
  'lookupGraph': LookupGraphFunctionType | undefined;
}>;
