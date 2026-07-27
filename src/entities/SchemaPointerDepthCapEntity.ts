import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Recursion budget for `SchemaPointerPathsType`'s JSON-Pointer path enumeration. */
export namespace SchemaPointerDepthCapEntity {
  export const Schema = { 'const': 5 } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 5;
  }
}
