import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { LookupSchemaFnType } from '../types/LookupSchemaFnType.js';

/** Options for `buildPropertyDefaults`. */
export type PropertyDefaultsOptionsType = {
  'context': SchemaCompilerValidatePlanContextType;
  'graph': SchemaGraphInterface;
  'lookupSchema': LookupSchemaFnType | undefined;
  'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
};
