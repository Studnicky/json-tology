import type { SchemaGraph } from '../modules/graph/SchemaGraph.js';

export interface GraphSerializerInterface {
  serialize(graphs: readonly SchemaGraph[]): unknown[];
}

export interface GraphSchemaSerializerInterface {
  serialize(graph: SchemaGraph): Record<string, unknown>;
}
