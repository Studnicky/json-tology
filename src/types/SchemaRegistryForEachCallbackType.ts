import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistryInterface.js';

export type SchemaRegistryForEachCallbackType = (
  schema: Record<string, unknown>,
  schemaId: string,
  registry: SchemaRegistryInterface
) => void;
