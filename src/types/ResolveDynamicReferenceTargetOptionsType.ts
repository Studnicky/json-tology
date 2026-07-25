import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFunctionType } from './LookupSchemaFunctionType.js';

/** Options for `DynamicRefTarget.resolve`. */
export type ResolveDynamicReferenceTargetOptionsType = Partial<{
  'lookupGraph': (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema': LookupSchemaFunctionType;
}>;
