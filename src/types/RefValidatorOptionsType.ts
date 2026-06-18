import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { LookupSchemaFnType } from '../types/LookupSchemaFnType.js';

/** Options for `compileRefValidator`. */
export type RefValidatorOptionsType = {
  readonly 'context': SchemaCompilerValidatePlanContextType;
  readonly 'formatRegistry': FormatRegistryInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'ref': string | undefined;
};
