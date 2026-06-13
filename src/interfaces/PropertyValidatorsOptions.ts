import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContext.js';
import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';

/** Options for `compilePropertyValidators`. */
export interface PropertyValidatorsOptionsInterface {
  readonly 'configStrict': boolean | undefined;
  readonly 'context': SchemaCompilerValidatePlanContextInterface;
  readonly 'formatRegistry': FormatRegistryInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  readonly 'propertyEntries': ReadonlyMap<string, SchemaGraphNodeInterface>;
}
