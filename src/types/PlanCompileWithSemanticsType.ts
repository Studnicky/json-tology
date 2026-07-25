import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextType } from './SchemaCompilerValidatePlanContextType.js';
import type { LookupSchemaFunctionType } from '../types/LookupSchemaFunctionType.js';
import type { SchemaGraphSemanticsType } from './SchemaGraph.js';
import type { InferType } from './Schema.js';
import type { PLAN_COMPILE_WITH_SEMANTICS_SCHEMA } from '../constants/SCHEMAS.js';

export type PlanCompileWithSemanticsType = InferType<typeof PLAN_COMPILE_WITH_SEMANTICS_SCHEMA> & {
  /** The compiler context providing validator/check builder methods. */
  'context': SchemaCompilerValidatePlanContextType;
  /** The format validator registry. */
  'formatRegistry': FormatRegistryInterface;
  /** The schema graph being compiled. */
  'graph': SchemaGraphInterface;
  /** Optional cross-schema lookup by `$id`. */
  'lookupSchema': LookupSchemaFunctionType | undefined;
  /** The schema graph semantics used during plan compilation. */
  'sem': SchemaGraphSemanticsType;
};
