import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Recursion depth cap for Compose's type-level tuple-walking utilities. */
export namespace TupleRecursionCapEntity {
  export const Schema = { 'const': 10 } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 10;
  }
}
