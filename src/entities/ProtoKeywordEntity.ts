import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** The `__proto__` object-key literal — a prototype-pollution vector. */
export namespace ProtoKeywordEntity {
  export const Schema = {
    'const': '__proto__',
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === '__proto__';
  }
}
