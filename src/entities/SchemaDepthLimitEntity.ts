import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Maximum recursion depth the registry allows while walking nested schema structure. */
export namespace SchemaDepthLimitEntity {
  export const Schema = { 'type': 'number' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'number';
  }
}
