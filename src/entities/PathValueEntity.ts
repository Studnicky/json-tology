import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** JSON Pointer path to a value within the document being processed. */
export namespace PathValueEntity {
  export const Schema = { 'type': 'string' } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return typeof candidate === 'string';
  }
}
