import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

export interface GraphSchemaSerializerInterface {
  serialize(graph: SchemaGraphInterface): Record<string, unknown>;
}
