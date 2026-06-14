import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

/** Options for `walkInheritedRef`. */
export type WalkInheritedRefOptionsType = {
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'ref': string;
  readonly 'walkFn': (g: SchemaGraphInterface, n: SchemaGraphNodeType) => void;
};
