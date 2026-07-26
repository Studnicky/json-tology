import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { ReferenceStringEntity } from '../entities/ReferenceStringEntity.js';

/** Options for `walkInheritedRef`. */
export interface WalkInheritedReferenceOptionsInterface {
  'currentGraph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'ref': ReferenceStringEntity.Type;
  'walkFn': (g: SchemaGraphInterface, n: SchemaGraphNodeInterface) => void;
}
