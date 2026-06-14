/**
 * GraphCompileOptions — shared compilation-context options for graph-level check helpers.
 *
 * Groups the four parameters that every graph-level check compiler receives,
 * reducing function arity and enabling cohesive parameter passing.
 */

import type { GraphCompileBaseOptionsType } from './GraphCompileBaseOptions.js';
import type { SchemaCompilerGraphContextType } from './SchemaCompilerGraphContext.js';
import type { LookupSchemaFnType } from '../types/LookupSchema.js';
import type { SchemaGraphSemanticsType } from './SchemaGraph.js';

export type GraphCompileOptionsType = GraphCompileBaseOptionsType<SchemaCompilerGraphContextType>;

export type GraphCompileWithSemanticsType = Omit<GraphCompileBaseOptionsType<SchemaCompilerGraphContextType>, 'lookupSchema'> & {
  /** Optional cross-schema lookup by `$id`. */
  readonly 'lookupSchema': LookupSchemaFnType | undefined;
  /** The schema graph semantics used during compilation. */
  readonly 'sem': SchemaGraphSemanticsType;
};
