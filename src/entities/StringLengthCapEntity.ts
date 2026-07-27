import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Above this length, `minLength`/`maxLength`/`pattern` literal-template inference widens to `string`. */
export namespace StringLengthCapEntity {
  export const Schema = { 'const': 8 } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 8;
  }
}
