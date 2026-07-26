import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Options accepted by {@link SchemaRegistryInterface.instantiate}.
 */
export namespace InstantiateCallOptionsEntity {
  export const Schema = {
    'properties': {
      'clone': { 'type': 'boolean' },
      'enableDefaults': { 'type': 'boolean' }
    },
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return (value.clone === undefined || typeof value.clone === 'boolean')
      && (value.enableDefaults === undefined || typeof value.enableDefaults === 'boolean');
  }
}
