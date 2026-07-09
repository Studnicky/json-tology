import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFnType } from './LookupSchemaFnType.js';

/** Options for `compileDynamicRefValidator`. */
export type DynamicRefValidatorOptionsType = {
  'context': SchemaCompilerValidatePlanContextType;
  'dynamicRef': string;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'lookupSchema': LookupSchemaFnType | undefined;
};
