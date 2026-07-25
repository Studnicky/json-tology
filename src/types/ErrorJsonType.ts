import type { InferType } from './Schema.js';

export const ErrorJsonSchema = {
  '$recursiveAnchor': true,
  'properties': {
    'cause': { '$recursiveRef': '#' },
    'code': { 'type': 'string' },
    'message': { 'type': 'string' },
    'retryable': { 'type': 'boolean' }
  },
  'required': [
    'code',
    'message',
    'retryable'
  ],
  'type': 'object'
} as const;

export type ErrorJsonType = InferType<typeof ErrorJsonSchema>;
