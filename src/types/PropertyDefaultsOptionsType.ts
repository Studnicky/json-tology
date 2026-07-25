import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { LookupSchemaFunctionType } from '../types/LookupSchemaFunctionType.js';

/** Options for `buildPropertyDefaults`. */
export type PropertyDefaultsOptionsType = {
  'context': SchemaCompilerValidatePlanContextType;
  'graph': SchemaGraphInterface;
  'lookupSchema': LookupSchemaFunctionType | undefined;
  'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
};
