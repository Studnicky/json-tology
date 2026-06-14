import type { GraphLookupType } from '../types/GraphLookup.js';
import type { SchemaLookupType } from '../types/SchemaLookup.js';

export type RefDecoderRegistryType = {
  readonly 'getGraph': GraphLookupType;
  readonly 'getSchema': SchemaLookupType;
  readonly 'resolveSchemaId': (rawId: string) => string;
};
