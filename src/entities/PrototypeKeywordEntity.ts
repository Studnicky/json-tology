import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** The `prototype` object-key literal — a prototype-pollution vector. */
export namespace PrototypeKeywordEntity {
  export const Schema = {
    'const': 'prototype',
    'type': 'string'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 'prototype';
  }
}
