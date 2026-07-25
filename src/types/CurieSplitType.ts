import type { InferType } from './Schema.js';

/**
 * Result of splitting a CURIE string on its first colon separator.
 */
export const CURIE_SPLIT_SCHEMA = {
  'properties': {
    'prefix': { 'type': 'string' },
    'reference': { 'type': 'string' }
  },
  'required': [
    'prefix',
    'reference'
  ],
  'type': 'object'
} as const;

export type CurieSplitType = InferType<typeof CURIE_SPLIT_SCHEMA>;
