import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContext.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistry.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Options for `compileRefValidator`. */
export type RefValidatorOptionsType = {
  readonly 'context': SchemaCompilerValidatePlanContextType;
  readonly 'formatRegistry': FormatRegistryInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'ref': string | undefined;
};
