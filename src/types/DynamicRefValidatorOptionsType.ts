import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFnType } from './LookupSchemaFnType.js';

/** Options for `compileDynamicRefValidator`. */
export type DynamicRefValidatorOptionsType = {
  readonly 'context': SchemaCompilerValidatePlanContextType;
  readonly 'dynamicRef': string;
  readonly 'formatRegistry': FormatRegistryInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
};
