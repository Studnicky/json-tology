import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** A single `false` literal field, shared by interfaces whose discriminant member is always `false`. */
export namespace FalseFlagEntity {
  export const Schema = { 'const': false } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === false;
  }
}
