/**
 * Validation types — expressed as json-tology schemas.
 */

import type { InferType } from './schema.js';
import { ValidationErrorSchema } from '../constants/schemas.js';

export type ValidationErrorType = InferType<typeof ValidationErrorSchema>;
