/**
 * Validation types — expressed as json-tology schemas.
 */

import type { InferType } from './schema.js';

export const ValidationErrorSchema = {
  '$id': 'https://json-tology.dev/ValidationError',
  'properties': {
    'keyword': {
      'description': 'Schema keyword that triggered the error',
      'type': 'string'
    },
    'message': {
      'description': 'Human-readable error message',
      'type': 'string'
    },
    'params': {
      'description': 'Keyword-specific parameters',
      'type': 'object'
    },
    'path': {
      'description': 'JSON Pointer path to the failing value',
      'type': 'string'
    }
  },
  'required': [
    'keyword',
    'message',
    'params',
    'path'
  ],
  'type': 'object'
} as const;

export type ValidationErrorType = InferType<typeof ValidationErrorSchema>;
