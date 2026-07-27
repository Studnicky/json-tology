import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** An array index or object property key used to reach a value from its parent container. */
export namespace PropertyKeyEntity {
  export const Schema = {
    'type': [
      'number',
      'string'
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'number' || typeof candidate === 'string';
  }
}
