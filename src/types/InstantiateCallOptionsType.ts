import type { InferType } from './Schema.js';

/**
 * Options accepted by {@link SchemaRegistryInterface.instantiate}.
 */
export const INSTANTIATE_CALL_OPTIONS_SCHEMA = {
  'properties': {
    'clone': { 'type': 'boolean' },
    'enableDefaults': { 'type': 'boolean' }
  },
  'type': 'object'
} as const;

export type InstantiateCallOptionsType = InferType<typeof INSTANTIATE_CALL_OPTIONS_SCHEMA>;
