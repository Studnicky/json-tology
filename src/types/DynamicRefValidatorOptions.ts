import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContext.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistry.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { LookupSchemaFnType } from './LookupSchema.js';

/** Options for `compileDynamicRefValidator`. */
export type DynamicRefValidatorOptionsType = {
  readonly 'context': SchemaCompilerValidatePlanContextType;
  readonly 'dynamicRef': string;
  readonly 'formatRegistry': FormatRegistryInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
};
