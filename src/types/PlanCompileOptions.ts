import type { GraphCompileBaseOptionsType } from './GraphCompileBaseOptions.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContext.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';
import type { SchemaGraphSemanticsType } from './SchemaGraph.js';

export type PlanCompileWithSemanticsType = Omit<GraphCompileBaseOptionsType<SchemaCompilerValidatePlanContextType>, 'lookupSchema'> & {
  /** Optional cross-schema lookup by `$id`. */
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  /** The schema graph semantics used during plan compilation. */
  readonly 'sem': SchemaGraphSemanticsType;
};
