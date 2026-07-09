import type { GraphCompileBaseOptionsType } from './GraphCompileBaseOptionsType.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { LookupSchemaFnType } from '../types/LookupSchemaFnType.js';
import type { SchemaGraphSemanticsType } from './SchemaGraph.js';

export type PlanCompileWithSemanticsType = Omit<GraphCompileBaseOptionsType<SchemaCompilerValidatePlanContextType>, 'lookupSchema'> & {
  /** Optional cross-schema lookup by `$id`. */
  'lookupSchema': LookupSchemaFnType | undefined;
  /** The schema graph semantics used during plan compilation. */
  'sem': SchemaGraphSemanticsType;
};
