import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { IdentityType } from './IdentityType.js';
import type { LookupSchemaFunctionType } from '../types/LookupSchemaFunctionType.js';

/** Options for `compileRefValidator`. */
export type ReferenceValidatorOptionsType = IdentityType<{
  'context': SchemaCompilerValidatePlanContextType;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'lookupSchema': LookupSchemaFunctionType | undefined;
  'ref': string | undefined;
}>;
