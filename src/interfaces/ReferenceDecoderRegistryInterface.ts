import type { GraphLookupInterface } from './GraphLookupInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';

export interface ReferenceDecoderRegistryInterface {
  'getGraph': GraphLookupInterface;
  'getSchema': LookupSchemaFunctionInterface;
  'resolveSchemaId': (rawId: string) => string;
}
