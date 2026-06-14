/**
 * PlanCompileOptions — shared compilation-context options for plan-level validate helpers.
 *
 * Groups the four parameters that every plan-level validator builder receives,
 * reducing function arity and enabling cohesive parameter passing.
 */

import type { GraphCompileBaseOptionsType } from './GraphCompileBaseOptions.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContext.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';
import type { SchemaGraphSemanticsType } from './SchemaGraph.js';

export type PlanCompileOptionsType = GraphCompileBaseOptionsType<SchemaCompilerValidatePlanContextType>;

export type PlanCompileWithSemanticsType = Omit<GraphCompileBaseOptionsType<SchemaCompilerValidatePlanContextType>, 'lookupSchema'> & {
  /** Optional cross-schema lookup by `$id`. */
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  /** The schema graph semantics used during plan compilation. */
  readonly 'sem': SchemaGraphSemanticsType;
};
