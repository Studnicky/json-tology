import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFnType } from './LookupSchemaFnType.js';

/** Options for `SchemaCompilerPlan.buildNodePlan`. */
export type BuildNodePlanOptionsType = {
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: LookupSchemaFnType;
};
