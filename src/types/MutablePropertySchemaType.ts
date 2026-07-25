/**
 * MutablePropertySchemaType — mutable property-level JSON Schema shape accumulated
 * during property restriction processing in the PropertyRestrictions dispatcher.
 */

import type { InferType } from './Schema.js';
import type { MUTABLE_PROPERTY_SCHEMA_SCHEMA } from '../constants/SCHEMAS.js';

export type MutablePropertySchemaType = InferType<typeof MUTABLE_PROPERTY_SCHEMA_SCHEMA> & {
  'const'?: unknown;
  'items'?: { '$ref': string };
};
