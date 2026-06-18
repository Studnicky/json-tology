import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { LookupSchemaFnType } from '../types/LookupSchemaFnType.js';

/** Options for `compilePropertyValidators`. */
export type PropertyValidatorsOptionsType = {
  readonly 'configStrict': boolean | undefined;
  readonly 'context': SchemaCompilerValidatePlanContextType;
  readonly 'formatRegistry': FormatRegistryInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
};
