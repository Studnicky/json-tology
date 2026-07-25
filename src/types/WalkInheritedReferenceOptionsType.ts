import type { IdentityType } from './IdentityType.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/** Options for `walkInheritedRef`. */
export type WalkInheritedReferenceOptionsType = IdentityType<{
  'currentGraph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'ref': string;
  'walkFn': (g: SchemaGraphInterface, n: SchemaGraphNodeType) => void;
}>;
