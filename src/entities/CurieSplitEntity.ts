import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Result of splitting a CURIE string on its first colon separator.
 */
export namespace CurieSplitEntity {
  export const Schema = {
    'properties': {
      'prefix': { 'type': 'string' },
      'reference': { 'type': 'string' }
    },
    'required': [
      'prefix',
      'reference'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.prefix === 'string'
      && typeof value.reference === 'string';
  }
}
