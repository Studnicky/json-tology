import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** A single `true` literal field, shared by interfaces whose discriminant member is always `true`. */
export namespace TrueFlagEntity {
  export const Schema = { 'const': true } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === true;
  }
}
