/**
 * Schema loader types — expressed as json-tology schemas.
 */

import type { InferType } from './schema.js';
import type {
  SchemaLoadErrorSchema, SchemaLoadResultSchema
} from '../constants/schemas.js';

export type SchemaLoadErrorType = InferType<typeof SchemaLoadErrorSchema>;
export type SchemaLoadResultType = InferType<typeof SchemaLoadResultSchema>;
