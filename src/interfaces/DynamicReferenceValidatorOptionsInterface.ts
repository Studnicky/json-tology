import type { SchemaCompilerValidatePlanContextInterface } from './SchemaCompilerValidatePlanContextInterface.js';
import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { LookupSchemaFunctionInterface } from './LookupSchemaFunctionInterface.js';
import type { DynamicReferenceValueEntity } from '../entities/DynamicReferenceValueEntity.js';

/** Options for `compileDynamicRefValidator`. */
export interface DynamicReferenceValidatorOptionsInterface {
  'context': SchemaCompilerValidatePlanContextInterface;
  'dynamicRef': DynamicReferenceValueEntity.Type;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'lookupSchema': LookupSchemaFunctionInterface | undefined;
}
