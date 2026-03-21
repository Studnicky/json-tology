import type { SchemaGraphInterface } from './schema-graph-impl.js';

export interface GraphSerializerInterface {
  serialize(graphs: readonly SchemaGraphInterface[]): unknown[];
}

export interface GraphSchemaSerializerInterface {
  serialize(graph: SchemaGraphInterface): Record<string, unknown>;
}
