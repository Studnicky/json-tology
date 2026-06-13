import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

/** Options for `walkInheritedRef`. */
export interface WalkInheritedRefOptionsInterface {
  readonly 'currentGraph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'ref': string;
  readonly 'walkFn': (g: SchemaGraphInterface, n: SchemaGraphNodeInterface) => void;
}
