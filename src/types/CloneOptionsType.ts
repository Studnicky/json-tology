import type { InferType } from './Schema.js';

/**
 * Options accepted by {@link SchemaRegistryInterface.cast} and
 * {@link SchemaRegistryInterface.convert}.
 */
export const CLONE_OPTIONS_SCHEMA = {
  'properties': { 'clone': { 'type': 'boolean' } },
  'type': 'object'
} as const;

export type CloneOptionsType = InferType<typeof CLONE_OPTIONS_SCHEMA>;
