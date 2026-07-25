import type { GraphLookupType } from '../types/GraphLookupType.js';
import type { IdentityType } from './IdentityType.js';
import type { SchemaLookupType } from '../types/SchemaLookupType.js';

export type ReferenceDecoderRegistryType = IdentityType<{
  'getGraph': GraphLookupType;
  'getSchema': SchemaLookupType;
  'resolveSchemaId': (rawId: string) => string;
}>;
