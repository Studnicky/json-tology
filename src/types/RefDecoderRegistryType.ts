import type { GraphLookupType } from '../types/GraphLookupType.js';
import type { SchemaLookupType } from '../types/SchemaLookupType.js';

export type RefDecoderRegistryType = {
  readonly 'getGraph': GraphLookupType;
  readonly 'getSchema': SchemaLookupType;
  readonly 'resolveSchemaId': (rawId: string) => string;
};
