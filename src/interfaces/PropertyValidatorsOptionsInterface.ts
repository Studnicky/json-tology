import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContextInterface.js';
import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';

/** Options for `compilePropertyValidators`. */
export interface PropertyValidatorsOptionsInterface {
  'configStrict': boolean | undefined;
  'context': SchemaCompilerValidatePlanContextInterface;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupSchema': LookupSchemaFunctionInterface | undefined;
  'propertyEntries': ReadonlyMap<string, SchemaGraphNodeInterface>;
}
