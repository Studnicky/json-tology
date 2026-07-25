import type { InferType } from './Schema.js';

export const VIZ_OPTIONS_SCHEMA = {
  'properties': {
    'noOpen': { 'type': 'boolean' },
    'output': { 'type': 'string' },
    'schema': { 'type': 'string' }
  },
  'required': [
    'noOpen',
    'output',
    'schema'
  ],
  'type': 'object'
} as const;

/** @internal — CLI visualization option shape; consumed only by the viz subpath, not the public package surface. */
export type VizOptionsType = InferType<typeof VIZ_OPTIONS_SCHEMA>;
