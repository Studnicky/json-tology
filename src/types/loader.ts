/**
 * Schema loader types — expressed as json-tology schemas.
 */

import type { InferType } from './schema.js';

export const SchemaLoadErrorSchema = {
  '$id': 'https://json-tology.dev/SchemaLoadError',
  'properties': {
    'file': { 'type': 'string' },
    'message': { 'type': 'string' },
    'reason': {
      'enum': [
        'duplicate-anchor',
        'duplicate-id',
        'invalid-json',
        'invalid-schema',
        'no-id',
        'not-json',
        'unknown'
      ],
      'type': 'string'
    }
  },
  'required': [
    'file',
    'message',
    'reason'
  ],
  'type': 'object'
} as const;

export const SchemaLoadResultSchema = {
  '$defs': { 'SchemaLoadError': SchemaLoadErrorSchema },
  '$id': 'https://json-tology.dev/SchemaLoadResult',
  'properties': {
    'errors': {
      'items': { '$ref': '#/$defs/SchemaLoadError' },
      'type': 'array'
    },
    'failed': { 'type': 'number' },
    'skipped': { 'type': 'number' },
    'successful': { 'type': 'number' }
  },
  'required': [
    'errors',
    'failed',
    'skipped',
    'successful'
  ],
  'type': 'object'
} as const;

export type SchemaLoadErrorType = InferType<typeof SchemaLoadErrorSchema>;
export type SchemaLoadResultType = InferType<typeof SchemaLoadResultSchema>;
