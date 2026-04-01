/**
 * Schema loader types — expressed as json-tology schemas.
 */

import type { InferType } from './Schema.js';
import type {
  SchemaLoadErrorSchema, SchemaLoadResultSchema
} from '../constants/SCHEMAS.js';

export type SchemaLoadErrorType = InferType<typeof SchemaLoadErrorSchema>;
export type SchemaLoadResultType = InferType<typeof SchemaLoadResultSchema>;
