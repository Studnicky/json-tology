import type { SchemaGraphSemanticsInterface } from './SchemaGraphSemanticsInterface.js';
import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContextInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';

export interface PlanCompileWithSemanticsInterface {
  /** The compiler context providing validator/check builder methods. */
  'context': SchemaCompilerValidatePlanContextInterface;
  /** The format validator registry. */
  'formatRegistry': FormatRegistryInterface;
  /** The schema graph being compiled. */
  'graph': SchemaGraphInterface;
  /** Optional cross-schema lookup by `$id`. */
  'lookupSchema': LookupSchemaFunctionInterface | undefined;
  /** The schema graph semantics used during plan compilation. */
  'sem': SchemaGraphSemanticsInterface;
}
