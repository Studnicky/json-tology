import type { InferType } from './Schema.js';

export const RawRestrictionDescriptorSchema = {
  'properties': {
    'kind': { 'type': 'string' },
    'onProperty': { 'type': 'string' },
    'value': {}
  },
  'required': [
    'kind',
    'onProperty',
    'value'
  ],
  'type': 'object'
} as const;

export type RawRestrictionDescriptorType = InferType<typeof RawRestrictionDescriptorSchema>;
