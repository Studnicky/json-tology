import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContext.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Options for `buildPropertyDefaults`. */
export type PropertyDefaultsOptionsType = {
  readonly 'context': SchemaCompilerValidatePlanContextType;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
};
