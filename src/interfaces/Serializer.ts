import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { QuadInterface } from './Quad.js';

export interface GraphSerializerInterface {
  serializeQuads(graphs: readonly SchemaGraphInterface[]): QuadInterface[];
}

export interface GraphSchemaSerializerInterface {
  serialize(graph: SchemaGraphInterface): Record<string, unknown>;
}
