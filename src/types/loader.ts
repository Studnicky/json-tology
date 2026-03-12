/**
 * Schema loader types — expressed as json-tology schemas.
 */

import type { InferType } from './schema.js';

export const SchemaLoadErrorSchema = {
  '$id': 'https://json-tology.dev/SchemaLoadError',
  'type': 'object',
  'properties': {
    'file': { 'type': 'string' },
    'message': { 'type': 'string' },
    'reason': {
      'enum': ['duplicate-id', 'invalid-json', 'invalid-schema', 'no-id', 'not-json', 'unknown'],
      'type': 'string'
    }
  },
  'required': ['file', 'message', 'reason']
} as const;

export const SchemaLoadResultSchema = {
  '$id': 'https://json-tology.dev/SchemaLoadResult',
  'type': 'object',
  'properties': {
    'errors': { 'type': 'array', 'items': { '$ref': '#/$defs/SchemaLoadError' } },
    'failed': { 'type': 'number' },
    'skipped': { 'type': 'number' },
    'successful': { 'type': 'number' }
  },
  'required': ['errors', 'failed', 'skipped', 'successful'],
  '$defs': {
    'SchemaLoadError': SchemaLoadErrorSchema
  }
} as const;

export type SchemaLoadErrorType = InferType<typeof SchemaLoadErrorSchema>;
export type SchemaLoadResultType = InferType<typeof SchemaLoadResultSchema>;
