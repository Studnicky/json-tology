import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';

/** Options for `DynamicRefTarget.resolve`. */
export interface ResolveDynamicReferenceTargetOptionsInterface {
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: LookupSchemaFunctionInterface;
}
