import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFnType } from './LookupSchemaFnType.js';

/** Options for `DynamicRefTarget.resolve`. */
export type ResolveDynamicRefTargetOptionsType = {
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: LookupSchemaFnType;
};
