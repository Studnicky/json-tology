import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** The `constructor` object-key literal — a prototype-pollution vector. */
export namespace ConstructorKeywordEntity {
  export const Schema = {
    'const': 'constructor',
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'constructor';
  }
}
