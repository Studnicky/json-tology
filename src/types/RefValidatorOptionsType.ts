import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { LookupSchemaFnType } from '../types/LookupSchemaFnType.js';

/** Options for `compileRefValidator`. */
export type RefValidatorOptionsType = {
  'context': SchemaCompilerValidatePlanContextType;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'lookupSchema': LookupSchemaFnType | undefined;
  'ref': string | undefined;
};
