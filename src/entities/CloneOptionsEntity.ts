import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Options accepted by {@link SchemaRegistryInterface.cast} and
 * {@link SchemaRegistryInterface.convert}.
 */
export namespace CloneOptionsEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': { 'clone': { 'type': 'boolean' } },
    'required': [],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return value.clone === undefined || typeof value.clone === 'boolean';
  }
}
