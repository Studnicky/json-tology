import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContext.js';
import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Options for `compileRefValidator`. */
export interface RefValidatorOptionsInterface {
  readonly 'context': SchemaCompilerValidatePlanContextInterface;
  readonly 'formatRegistry': FormatRegistryInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'ref': string | undefined;
}
