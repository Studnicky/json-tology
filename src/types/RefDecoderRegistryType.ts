import type { GraphLookupType } from '../types/GraphLookupType.js';
import type { SchemaLookupType } from '../types/SchemaLookupType.js';

export type RefDecoderRegistryType = {
  'getGraph': GraphLookupType;
  'getSchema': SchemaLookupType;
  'resolveSchemaId': (rawId: string) => string;
};
