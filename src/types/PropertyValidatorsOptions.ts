import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContext.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistry.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Options for `compilePropertyValidators`. */
export type PropertyValidatorsOptionsType = {
  readonly 'configStrict': boolean | undefined;
  readonly 'context': SchemaCompilerValidatePlanContextType;
  readonly 'formatRegistry': FormatRegistryInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
};
