import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/** Above this range width, integer/multipleOf literal-union inference widens to `number`. */
export namespace IntegerRangeCapEntity {
  export const Schema = { 'const': 50 } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    return candidate === 50;
  }
}
