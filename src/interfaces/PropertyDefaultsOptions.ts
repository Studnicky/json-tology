import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContext.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Options for `buildPropertyDefaults`. */
export interface PropertyDefaultsOptionsInterface {
  readonly 'context': SchemaCompilerValidatePlanContextInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'propertyEntries': ReadonlyMap<string, SchemaGraphNodeInterface>;
}
