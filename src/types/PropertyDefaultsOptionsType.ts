import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { LookupSchemaFnType } from '../types/LookupSchemaFnType.js';

/** Options for `buildPropertyDefaults`. */
export type PropertyDefaultsOptionsType = {
  readonly 'context': SchemaCompilerValidatePlanContextType;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
};
