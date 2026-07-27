import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';

/** Options for `SchemaCompilerPlan.buildNodePlan`. */
export interface BuildNodePlanOptionsInterface {
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: LookupSchemaFunctionInterface;
}
