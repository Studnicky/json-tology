import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** An array of strings, shared by interfaces whose members are bare string lists. */
export namespace StringArrayEntity {
  export const Schema = {
    'items': { 'type': 'string' },
    'type': 'array'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return Array.isArray(candidate) && candidate.every((entry) => {
      return typeof entry === 'string';
    });
  }
}
