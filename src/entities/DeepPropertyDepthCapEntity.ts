import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Recursion budget for `DeepPropertyPathsType`'s dotted-path enumeration. */
export namespace DeepPropertyDepthCapEntity {
  export const Schema = { 'const': 4 } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 4;
  }
}
