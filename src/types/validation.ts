/**
 * Validation types — expressed as json-tology schemas.
 */

import type { InferType } from './schema.js';

export const ValidationErrorSchema = {
  '$id': 'https://json-tology.dev/ValidationError',
  'type': 'object',
  'properties': {
    'keyword': { 'type': 'string', 'description': 'Schema keyword that triggered the error' },
    'message': { 'type': 'string', 'description': 'Human-readable error message' },
    'params': { 'type': 'object', 'description': 'Keyword-specific parameters' },
    'path': { 'type': 'string', 'description': 'JSON Pointer path to the failing value' }
  },
  'required': ['keyword', 'message', 'params', 'path']
} as const;

export type ValidationErrorType = InferType<typeof ValidationErrorSchema>;
