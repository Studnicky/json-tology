import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/** Options for `walkInheritedRef`. */
export type WalkInheritedRefOptionsType = {
  'currentGraph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'ref': string;
  'walkFn': (g: SchemaGraphInterface, n: SchemaGraphNodeType) => void;
};
