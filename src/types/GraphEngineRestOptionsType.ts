import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { IdentityType } from './IdentityType.js';

export type GraphEngineRestOptionsType = IdentityType<{
  'allowAdditionalProperties'?: boolean;
  'applyDefaults'?: boolean;
  'castTypes'?: boolean;
  'collectErrors'?: boolean;
  'enforceSchemaProperties'?: boolean;
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: (schemaId: string) => Record<string, unknown> | undefined;
  'materializeContainers'?: boolean;
  'maxSchemaDepth'?: number;
  'removeAdditionalProperties'?: boolean;
  'synthesizeDefaults'?: boolean;
}>;
