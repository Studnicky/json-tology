import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContextInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';

/** Options for `buildPropertyDefaults`. */
export interface PropertyDefaultsOptionsInterface {
  'context': SchemaCompilerValidatePlanContextInterface;
  'graph': SchemaGraphInterface;
  'lookupSchema': LookupSchemaFunctionInterface | undefined;
  'propertyEntries': ReadonlyMap<string, SchemaGraphNodeInterface>;
}
