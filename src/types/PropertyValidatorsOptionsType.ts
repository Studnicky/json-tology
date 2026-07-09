import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { LookupSchemaFnType } from '../types/LookupSchemaFnType.js';

/** Options for `compilePropertyValidators`. */
export type PropertyValidatorsOptionsType = {
  'configStrict': boolean | undefined;
  'context': SchemaCompilerValidatePlanContextType;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupSchema': LookupSchemaFnType | undefined;
  'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
};
