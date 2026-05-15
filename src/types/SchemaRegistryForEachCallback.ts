import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistry.js';

export type SchemaRegistryForEachCallback = (
  schema: Record<string, unknown>,
  schemaId: string,
  registry: SchemaRegistryInterface
) => void;
