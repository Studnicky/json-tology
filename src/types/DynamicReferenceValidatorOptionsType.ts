import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFunctionType } from './LookupSchemaFunctionType.js';
import type { IdentityType } from './IdentityType.js';

/** Options for `compileDynamicRefValidator`. */
export type DynamicReferenceValidatorOptionsType = IdentityType<{
  'context': SchemaCompilerValidatePlanContextType;
  'dynamicRef': string;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'lookupSchema': LookupSchemaFunctionType | undefined;
}>;
