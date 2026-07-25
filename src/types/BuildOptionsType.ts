import type { InferType } from './Schema.js';

export const BuildOptionsTypeSchema = {
  'properties': {
    'baseIri': { 'type': 'string' },
    'format': { 'type': 'string' },
    'output': { 'type': 'string' },
    'outputFile': { 'type': 'string' },
    'schema': { 'type': 'string' }
  },
  'required': [
    'format',
    'output',
    'schema'
  ],
  'type': 'object'
} as const;

/** @internal — CLI build option shape; not part of the public package surface. */
export type BuildOptionsType = InferType<typeof BuildOptionsTypeSchema>;
