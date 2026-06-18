import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { QuadInterface } from './QuadInterface.js';

export interface GraphSerializerInterface {
  serializeQuads(graphs: readonly SchemaGraphInterface[]): QuadInterface[];
}
