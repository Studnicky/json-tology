import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContextInterface.js';
import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';

/** Options for `compileRefValidator`. */
export interface ReferenceValidatorOptionsInterface {
  'context': SchemaCompilerValidatePlanContextInterface;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'lookupSchema': LookupSchemaFunctionInterface | undefined;
  'ref': string | undefined;
}
