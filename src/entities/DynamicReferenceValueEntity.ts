import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** A `$dynamicRef` pointer string being resolved during dynamic-scope validation. */
export namespace DynamicReferenceValueEntity {
  export const Schema = { 'type': 'string' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string';
  }
}
