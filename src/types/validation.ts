/**
 * Validation types — expressed as json-tology schemas.
 */

import type { InferType } from './schema.js';
import type { ValidationErrorSchema } from '../constants/schemas.js';

export type ValidationErrorType = InferType<typeof ValidationErrorSchema>;

export type CheckFnType = (value: unknown) => boolean;
