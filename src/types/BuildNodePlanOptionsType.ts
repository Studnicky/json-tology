import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFunctionType } from './LookupSchemaFunctionType.js';

/** Options for `SchemaCompilerPlan.buildNodePlan`. */
export type BuildNodePlanOptionsType = Partial<{
  'lookupGraph': (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema': LookupSchemaFunctionType;
}>;
